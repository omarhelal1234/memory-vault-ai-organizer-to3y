// Supabase Edge Function: analyze-memory
// Processes pending memories with OpenAI and writes structured AI metadata back.
//
// Auth: this function runs with the service role, so it is NOT publicly callable.
// Callers (cron / server) must present a shared secret in the `x-cron-secret`
// header that matches the CRON_SECRET function secret. Deploy with verify_jwt=false.
//
// Extraction logic is shared with `process-my-memories` via ../_shared/extract.ts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  extractMemory,
  buildTaxonomy,
  type MemoryInput,
  type Taxonomy,
} from '../_shared/extract.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const BATCH_SIZE = 5;

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
      .select('id, user_id, type, storage_path, url, content_text, title')
      .eq('processing_status', 'pending')
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;
    if (!pending || pending.length === 0) {
      return json({ message: 'No pending memories to process' });
    }

    // Taxonomy is per-user; cache it so a multi-user batch only loads each once.
    const taxonomyCache = new Map<string, Taxonomy>();
    const results = [];
    // Sequential to avoid firing BATCH_SIZE expensive OpenAI jobs at once.
    for (const memory of pending as (MemoryInput & { user_id: string })[]) {
      let taxonomy = taxonomyCache.get(memory.user_id);
      if (!taxonomy) {
        taxonomy = await loadTaxonomy(supabase, memory.user_id);
        taxonomyCache.set(memory.user_id, taxonomy);
      }
      results.push(await processMemory(supabase, memory, taxonomy));
    }

    return json({ processed: results.length, results });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});

// Existing taxonomy for one user (service-role client, so scope by user_id).
async function loadTaxonomy(supabase: any, userId: string): Promise<Taxonomy> {
  const { data } = await supabase
    .from('memories')
    .select('category, subcategory')
    .eq('user_id', userId)
    .eq('processing_status', 'completed')
    .not('category', 'is', null);
  return buildTaxonomy(data ?? []);
}

async function processMemory(supabase: any, memory: MemoryInput, taxonomy: Taxonomy) {
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
    const result = await extractMemory(OPENAI_API_KEY!, memory, supabase, taxonomy);

    const { error: updateError } = await supabase
      .from('memories')
      .update({
        processing_status: 'completed',
        ai_metadata: result.ai_metadata,
        category: result.category,
        subcategory: result.subcategory,
        structured_data: result.structured_data,
        extracted_links: result.extracted_links,
        spark_score: result.spark_score,
        priority: result.priority,
      })
      .eq('id', memory.id);
    if (updateError) throw updateError;

    return { id: memory.id, status: 'success' };
  } catch (error) {
    // Log full detail server-side; return only a generic message so provider
    // internals (e.g. raw OpenAI error bodies) are never echoed to callers.
    console.error(`analyze-memory failed for ${memory.id}:`, error);
    const { error: failError } = await supabase
      .from('memories')
      .update({ processing_status: 'failed' })
      .eq('id', memory.id);
    return {
      id: memory.id,
      status: 'failed',
      error: 'Extraction failed',
      ...(failError ? { writebackError: 'writeback failed' } : {}),
    };
  }
}
