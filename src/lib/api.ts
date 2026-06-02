import { supabase } from './supabase';
import type { Memory } from '../types';

// Columns we read for list/detail views.
const MEMORY_COLUMNS =
  'id, user_id, type, storage_path, content_text, url, processing_status, ai_metadata, category, structured_data, extracted_links, spark_score, title, notes, created_at, updated_at, captured_at';

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not signed in.');
  return data.user.id;
}

export async function listMemories(): Promise<Memory[]> {
  const { data, error } = await supabase
    .from('memories')
    .select(MEMORY_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Memory[];
}

export async function getMemory(id: string): Promise<Memory> {
  const { data, error } = await supabase
    .from('memories')
    .select(MEMORY_COLUMNS)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Memory;
}

export async function createNote(text: string, title?: string): Promise<Memory> {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from('memories')
    .insert({ user_id, type: 'note', content_text: text, title: title || null })
    .select(MEMORY_COLUMNS)
    .single();
  if (error) throw error;
  return data as Memory;
}

export async function createLink(url: string, title?: string): Promise<Memory> {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from('memories')
    .insert({ user_id, type: 'link', url, title: title || null })
    .select(MEMORY_COLUMNS)
    .single();
  if (error) throw error;
  return data as Memory;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/gif': 'gif',
};

export async function createImageMemory(
  uri: string,
  mimeType: string,
  title?: string
): Promise<Memory> {
  const user_id = await requireUserId();

  // Fetch the picked file as a Blob (works for blob:/data:/file: URIs on web).
  const res = await fetch(uri);
  const blob = await res.blob();
  const contentType = mimeType || blob.type || 'image/jpeg';
  const ext = EXT_BY_MIME[contentType] ?? 'jpg';

  // Storage RLS requires the first path segment to be the user's id.
  const path = `${user_id}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('memories')
    .upload(path, blob, { contentType, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('memories')
    .insert({ user_id, type: 'screenshot', storage_path: path, title: title || null })
    .select(MEMORY_COLUMNS)
    .single();
  if (error) throw error;
  return data as Memory;
}

// Returns a temporary signed URL to display a private storage object.
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('memories')
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function searchMemories(query: string): Promise<Memory[]> {
  const q = query.trim();
  if (!q) return [];
  // PostgREST treats commas/parens as filter syntax inside .or(); strip them so a
  // user's search text can't break (or alter) the query. RLS still scopes results
  // to the caller regardless. '%' and '_' are left as-is (treated as ilike wildcards).
  const safe = q.replace(/[,()]/g, ' ').trim();
  if (!safe) return [];
  const like = `%${safe}%`;
  const { data, error } = await supabase
    .from('memories')
    .select(MEMORY_COLUMNS)
    .or(`title.ilike.${like},content_text.ilike.${like},url.ilike.${like}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Memory[];
}

// Invokes the user-scoped Edge Function that runs OpenAI on pending memories.
// Auth is the caller's own JWT (attached automatically by supabase-js).
export async function processMyMemories(): Promise<{ processed: number } | null> {
  const { data, error } = await supabase.functions.invoke('process-my-memories', {
    body: {},
  });
  if (error) {
    // Non-fatal: surfacing it would interrupt capture. Caller can ignore.
    console.warn('process-my-memories failed:', error.message);
    return null;
  }
  return data as { processed: number };
}

// Helpers for displaying AI results.
export function categoriesOf(m: Memory): string[] {
  return m.ai_metadata?.suggested_categories ?? [];
}

export function primaryCategory(m: Memory): string | null {
  // Prefer the denormalized `category` column; fall back to legacy ai_metadata.
  return m.category ?? categoriesOf(m)[0] ?? null;
}

// Emoji per canonical category, used in the feed and detail header.
const CATEGORY_ICON: Record<string, string> = {
  Ideas: '💡',
  Recipes: '🍳',
  'Movies to Watch': '🎬',
  'GitHub Repos': '💻',
  'AI News': '🤖',
  'Travel Ideas': '✈️',
  Shopping: '🛍️',
  Other: '📦',
};

export function categoryIcon(category?: string | null): string {
  return (category && CATEGORY_ICON[category]) || '📦';
}
