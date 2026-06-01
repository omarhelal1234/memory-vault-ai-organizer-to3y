// Supabase Edge Function: analyze-memory
// Processes pending memories with OpenAI and writes AI metadata back.
//
// Auth: this function runs with the service role, so it is NOT publicly callable.
// Callers (cron / server) must present a shared secret in the `x-cron-secret`
// header that matches the CRON_SECRET function secret. Deploy with verify_jwt=false.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const BATCH_SIZE = 5;
const CHAT_MODEL = 'gpt-4o';

interface Memory {
  id: string;
  type: string;
  storage_path?: string;
  url?: string;
  content_text?: string;
  title?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  // Authenticate the caller with a shared secret (length check first, then compare).
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!CRON_SECRET || provided.length !== CRON_SECRET.length || provided !== CRON_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server is missing required environment variables' }, 500);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: pending, error: fetchError } = await supabase
      .from('memories')
      .select('id, type, storage_path, url, content_text, title')
      .eq('processing_status', 'pending')
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;
    if (!pending || pending.length === 0) {
      return json({ message: 'No pending memories to process' });
    }

    const results = [];
    // Sequential to avoid firing BATCH_SIZE expensive OpenAI jobs at once.
    for (const memory of pending as Memory[]) {
      results.push(await processMemory(supabase, memory));
    }

    return json({ processed: results.length, results });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});

async function processMemory(supabase: any, memory: Memory) {
  // Atomically claim the row: only one worker can flip pending -> processing.
  const { data: claimed, error: claimError } = await supabase
    .from('memories')
    .update({ processing_status: 'processing' })
    .eq('id', memory.id)
    .eq('processing_status', 'pending')
    .select('id');

  if (claimError) return { id: memory.id, status: 'error', error: claimError.message };
  if (!claimed || claimed.length === 0) {
    return { id: memory.id, status: 'skipped', reason: 'already claimed' };
  }

  try {
    const aiMetadata = await analyze(memory, supabase);

    const { error: updateError } = await supabase
      .from('memories')
      .update({ processing_status: 'completed', ai_metadata: aiMetadata })
      .eq('id', memory.id);
    if (updateError) throw updateError;

    return { id: memory.id, status: 'success' };
  } catch (error) {
    const { error: failError } = await supabase
      .from('memories')
      .update({ processing_status: 'failed' })
      .eq('id', memory.id);
    return {
      id: memory.id,
      status: 'failed',
      error: (error as Error).message,
      ...(failError ? { writebackError: failError.message } : {}),
    };
  }
}

async function analyze(memory: Memory, supabase: any) {
  switch (memory.type) {
    case 'screenshot':
    case 'photo':
      return analyzeImage(memory, supabase);
    case 'voice_memo':
      return transcribeAudio(memory, supabase);
    case 'link':
      return analyzeText(`URL: ${memory.url ?? 'Unknown'}. Title: ${memory.title ?? memory.content_text ?? 'Unknown'}.`);
    case 'note':
      return analyzeText(`Note: ${memory.content_text ?? memory.title ?? '(empty)'}`);
    case 'video':
      // No video transcription pipeline yet; record minimal metadata.
      return { summary: memory.title ?? 'Video memory', suggested_categories: ['Other'], suggested_tags: [] };
    default:
      throw new Error(`Unsupported memory type: ${memory.type}`);
  }
}

const CATEGORY_PROMPT =
  'Categories to choose from: Movies to Watch, GitHub Repos, AI News, Recipes, Travel Ideas, Shopping, Other. ' +
  'Respond as JSON with keys: summary (string), suggested_categories (string[]), suggested_tags (string[]).';

async function chatJSON(messages: unknown[], maxTokens = 500) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) {
    throw new Error(`OpenAI chat error ${resp.status}: ${await resp.text()}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI chat returned no content');
  return JSON.parse(content);
}

async function analyzeText(input: string) {
  return chatJSON([
    { role: 'user', content: `Categorize this memory. ${CATEGORY_PROMPT}\n\n${input}` },
  ], 300);
}

function mimeFromPath(path?: string): string {
  const ext = (path?.split('.').pop() ?? '').toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'heic': return 'image/heic';
    case 'gif': return 'image/gif';
    default: return 'image/jpeg';
  }
}

function toBase64(bytes: Uint8Array): string {
  // Chunked to avoid "Maximum call stack size exceeded" on large files.
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function analyzeImage(memory: Memory, supabase: any) {
  if (!memory.storage_path) throw new Error('Image memory has no storage_path');

  const { data: imageData, error } = await supabase.storage.from('memories').download(memory.storage_path);
  if (error) throw error;

  const bytes = new Uint8Array(await imageData.arrayBuffer());
  const dataUrl = `data:${mimeFromPath(memory.storage_path)};base64,${toBase64(bytes)}`;

  return chatJSON([
    {
      role: 'user',
      content: [
        { type: 'text', text: `Analyze this image. ${CATEGORY_PROMPT}` },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ], 500);
}

async function transcribeAudio(memory: Memory, supabase: any) {
  if (!memory.storage_path) throw new Error('Voice memo has no storage_path');

  const { data: audioData, error } = await supabase.storage.from('memories').download(memory.storage_path);
  if (error) throw error;

  const form = new FormData();
  form.append('file', audioData, 'audio.m4a');
  form.append('model', 'whisper-1');

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!resp.ok) {
    throw new Error(`OpenAI transcription error ${resp.status}: ${await resp.text()}`);
  }
  const { text: transcript } = await resp.json();

  const metadata = await analyzeText(`Voice memo transcript: "${transcript}"`);
  return { ...metadata, transcript };
}
