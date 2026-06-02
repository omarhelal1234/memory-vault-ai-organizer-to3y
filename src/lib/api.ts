import { supabase } from './supabase';
import type { Memory } from '../types';

// Columns we read for list/detail views.
const MEMORY_COLUMNS =
  'id, user_id, type, storage_path, content_text, url, processing_status, ai_metadata, category, subcategory, structured_data, extracted_links, spark_score, priority, done, title, notes, created_at, updated_at, captured_at';

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

// Runs the auto-merge pass that collapses near-duplicate categories/subcategories.
export async function reconcileTaxonomy(): Promise<{ reconciled: number; rowsMoved: number } | null> {
  const { data, error } = await supabase.functions.invoke('process-my-memories', {
    body: { mode: 'reconcile' },
  });
  if (error) {
    console.warn('reconcile failed:', error.message);
    return null;
  }
  return data as { reconciled: number; rowsMoved: number };
}

// Update a memory's triage priority (1-3) or done flag.
export async function setPriority(id: string, priority: number | null): Promise<void> {
  const { error } = await supabase.from('memories').update({ priority }).eq('id', id);
  if (error) throw error;
}

export async function setDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('memories').update({ done }).eq('id', id);
  if (error) throw error;
}

// Helpers for displaying AI results.
export function categoriesOf(m: Memory): string[] {
  return m.ai_metadata?.suggested_categories ?? [];
}

export function primaryCategory(m: Memory): string | null {
  // Prefer the denormalized `category` column; fall back to legacy ai_metadata.
  return m.category ?? categoriesOf(m)[0] ?? null;
}

export function subcategoryOf(m: Memory): string {
  return (m.subcategory ?? '').trim() || 'General';
}

// ---------------------------------------------------------------------------
// Taxonomy aggregation for the drill-down navigation. All derived client-side
// from listMemories() so it stays correct no matter what the AI invents.
// ---------------------------------------------------------------------------

export type CategoryGroup = {
  name: string;
  count: number;
  todo: number; // not-done, priority-rated items
  icon: string;
  color: string;
};

export type SubcategoryGroup = { name: string; count: number; todo: number };

const ANALYZED = (m: Memory) => m.processing_status === 'completed' && !!m.category;

export function topCategories(memories: Memory[]): CategoryGroup[] {
  const map = new Map<string, { count: number; todo: number }>();
  for (const m of memories) {
    if (!ANALYZED(m)) continue;
    const name = m.category as string;
    const g = map.get(name) ?? { count: 0, todo: 0 };
    g.count += 1;
    if (!m.done) g.todo += 1;
    map.set(name, g);
  }
  return [...map.entries()]
    .map(([name, g]) => ({
      name,
      count: g.count,
      todo: g.todo,
      icon: categoryIcon(name),
      color: categoryColor(name),
    }))
    .sort((a, b) => b.count - a.count);
}

export function subcategoriesOf(memories: Memory[], category: string): SubcategoryGroup[] {
  const map = new Map<string, { count: number; todo: number }>();
  for (const m of memories) {
    if (!ANALYZED(m) || m.category !== category) continue;
    const name = subcategoryOf(m);
    const g = map.get(name) ?? { count: 0, todo: 0 };
    g.count += 1;
    if (!m.done) g.todo += 1;
    map.set(name, g);
  }
  return [...map.entries()]
    .map(([name, g]) => ({ name, count: g.count, todo: g.todo }))
    .sort((a, b) => b.count - a.count);
}

export function itemsIn(memories: Memory[], category: string, subcategory?: string): Memory[] {
  return memories
    .filter((m) => ANALYZED(m) && m.category === category)
    .filter((m) => !subcategory || subcategoryOf(m) === subcategory)
    .sort((a, b) => {
      // Open to-dos first, then by priority desc, then newest.
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      if (pa !== pb) return pb - pa;
      return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    });
}

// Memories still awaiting AI categorization (shown in their own "Processing" lane).
export function unprocessed(memories: Memory[]): Memory[] {
  return memories.filter((m) => !ANALYZED(m));
}

// Emoji per known category; dynamic/AI-invented names get a deterministic emoji.
const CATEGORY_ICON: Record<string, string> = {
  Ideas: '💡',
  Recipes: '🍳',
  'Watch Later': '🎬',
  'Movies to Watch': '🎬',
  'GitHub Repos': '💻',
  'AI News': '🤖',
  Travel: '✈️',
  'Travel Ideas': '✈️',
  Shopping: '🛍️',
  Reels: '📱',
  Other: '📦',
};

const FALLBACK_ICONS = ['🏷️', '📚', '🧩', '🎯', '🔖', '🗂️', '✨', '🧠', '📌', '🌱'];
const PALETTE = [
  '#6366F1', '#EC4899', '#8B5CF6', '#3B82F6', '#F59E0B',
  '#06B6D4', '#10B981', '#EF4444', '#14B8A6', '#A855F7',
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function categoryIcon(category?: string | null): string {
  if (!category) return '📦';
  return CATEGORY_ICON[category] ?? FALLBACK_ICONS[hash(category) % FALLBACK_ICONS.length];
}

export function categoryColor(category?: string | null): string {
  if (!category) return '#6B7280';
  return PALETTE[hash(category) % PALETTE.length];
}

// Visual config for the 1-3 triage priority.
export const PRIORITY_META: Record<number, { label: string; color: string; bg: string }> = {
  3: { label: 'High', color: '#991B1B', bg: '#FEE2E2' },
  2: { label: 'Medium', color: '#92400E', bg: '#FEF3C7' },
  1: { label: 'Low', color: '#1E40AF', bg: '#DBEAFE' },
};
