// Supabase Edge Function: process-my-memories
//
// User-invokable counterpart to `analyze-memory`. Deployed with verify_jwt=true,
// so it can only be called by an authenticated user. It processes ONLY the
// caller's own pending memories, using a Supabase client bound to the caller's
// JWT (so RLS scopes every read/write/storage access to that user).
//
// Auth model: the caller's JWT. No CRON_SECRET / service-role key required.
// Only secret needed: OPENAI_API_KEY (set as an Edge Function secret).
//
// Extraction logic is shared with `analyze-memory` via ../_shared/extract.ts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractMemory, type MemoryInput } from '../_shared/extract.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

const BATCH_SIZE = 10;

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
    for (const memory of pending as MemoryInput[]) {
      results.push(await processMemory(supabase, memory));
    }

    return json({ processed: results.length, results });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});

async function processMemory(supabase: any, memory: MemoryInput) {
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
    const result = await extractMemory(OPENAI_API_KEY!, memory, supabase);
    const { error: updateError } = await supabase
      .from('memories')
      .update({
        processing_status: 'completed',
        ai_metadata: result.ai_metadata,
        category: result.category,
        structured_data: result.structured_data,
        extracted_links: result.extracted_links,
        spark_score: result.spark_score,
      })
      .eq('id', memory.id);
    if (updateError) throw updateError;
    return { id: memory.id, status: 'success' };
  } catch (error) {
    // Log full detail server-side; return only a generic message so provider
    // internals (e.g. raw OpenAI error bodies) are never echoed to callers.
    console.error(`process-my-memories failed for ${memory.id}:`, error);
    await supabase
      .from('memories')
      .update({ processing_status: 'failed' })
      .eq('id', memory.id);
    return { id: memory.id, status: 'failed', error: 'Extraction failed' };
  }
}
