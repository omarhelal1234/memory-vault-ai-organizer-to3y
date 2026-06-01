// Supabase Edge Function: process-my-memories
//
// User-invokable counterpart to `analyze-memory`. Deployed with verify_jwt=true,
// so it can only be called by an authenticated user. It processes ONLY the
// caller's own pending memories, using a Supabase client bound to the caller's
// JWT (so RLS scopes every read/write/storage access to that user).
//
// Auth model: the caller's JWT. No CRON_SECRET / service-role key required.
// Only secret needed: OPENAI_API_KEY (set as an Edge Function secret).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

const BATCH_SIZE = 10;
const CHAT_MODEL = 'gpt-4o';

interface Memory {
  id: string;
  type: string;
  storage_path?: string;
  url?: string;
  content_text?: string;
  title?: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ error: 'Server is missing required environment variables' }, 500);
  }

  // RLS-scoped client: every query runs as the calling user.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);

  try {
    const { data: pending, error: fetchError } = await supabase
      .from('memories')
      .select('id, type, storage_path, url, content_text, title')
      .eq('processing_status', 'pending')
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;
    if (!pending || pending.length === 0) {
      return json({ processed: 0, results: [] });
    }

    const results = [];
    for (const memory of pending as Memory[]) {
      results.push(await processMemory(supabase, memory));
    }

    return json({ processed: results.length, results });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});

async function processMemory(supabase: any, memory: Memory) {
  // Atomically claim the row: only flip it if still pending (and owned by caller via RLS).
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
    await supabase
      .from('memories')
      .update({ processing_status: 'failed' })
      .eq('id', memory.id);
    return { id: memory.id, status: 'failed', error: (error as Error).message };
  }
}

async function analyze(memory: Memory, supabase: any) {
  switch (memory.type) {
    case 'screenshot':
    case 'photo':
      return analyzeImage(memory, supabase);
    case 'link':
      return analyzeText(
        `URL: ${memory.url ?? 'Unknown'}. Title: ${memory.title ?? memory.content_text ?? 'Unknown'}.`
      );
    case 'note':
      return analyzeText(`Note: ${memory.content_text ?? memory.title ?? '(empty)'}`);
    case 'video':
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
  return chatJSON(
    [{ role: 'user', content: `Categorize this memory. ${CATEGORY_PROMPT}\n\n${input}` }],
    300
  );
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
  return chatJSON(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Analyze this image. ${CATEGORY_PROMPT}` },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    500
  );
}
