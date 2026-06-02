// Shared structured-extraction engine for both Edge Functions
// (analyze-memory + process-my-memories).
//
// Given a memory (and the user's EXISTING taxonomy) it asks OpenAI to:
//   1. File it under a category + subcategory, REUSING an existing one when it
//      fits and only inventing a new one when nothing does (fully dynamic taxonomy).
//   2. Extract REAL, card-specific structured data (recipe steps, article TL;DR,
//      reel action-items, idea next-action, ...).
//   3. Pull every URL out of the content (incl. text inside screenshots).
//   4. Assign a triage `priority` (1-3) and, for ideas, a 0-100 spark score.
//
// For link captures it first fetches the link's public oEmbed / Open-Graph
// metadata, so a pasted TikTok / Reel / YouTube URL is analyzed from its real
// caption + author + thumbnail rather than the bare URL.
//
// `reconcileTaxonomy()` is a separate pass that merges near-duplicate
// categories/subcategories after the fact.

const CHAT_MODEL = 'gpt-4o';

export interface MemoryInput {
  id: string;
  type: string;
  storage_path?: string;
  url?: string;
  content_text?: string;
  title?: string;
}

// The user's current taxonomy, passed in so the model reuses it instead of
// inventing synonyms. Each entry is a top-level category and its subcategories.
export interface Taxonomy {
  categories: { name: string; subcategories: string[] }[];
}

export interface ExtractionResult {
  // Legacy shape (kept for backward compatibility with existing UI/api).
  ai_metadata: {
    summary?: string;
    suggested_categories?: string[];
    suggested_tags?: string[];
    transcript?: string;
  };
  // Dynamic taxonomy + new structured columns.
  category: string;
  subcategory: string;
  structured_data: Record<string, unknown> | null;
  extracted_links: { url: string; label?: string }[];
  spark_score: number | null;
  priority: number | null;
}

// The fixed set of rich-card renderers the UI knows how to draw. The taxonomy is
// dynamic, but `structured_data.kind` must be one of these (or null) — the
// category and the card kind are independent now.
const STRUCTURED_KINDS = [
  'idea',
  'recipe',
  'movie',
  'repo',
  'article',
  'travel',
  'product',
  'reel',
] as const;

const SEED_CATEGORIES = [
  'Ideas',
  'Recipes',
  'Watch Later',
  'GitHub Repos',
  'AI News',
  'Travel',
  'Shopping',
  'Other',
];

// Renders the user's existing taxonomy into the prompt so the model files things
// under what already exists instead of minting synonyms.
function taxonomyBlock(taxonomy?: Taxonomy): string {
  const cats = taxonomy?.categories?.filter((c) => c.name) ?? [];
  if (cats.length === 0) {
    return `The user's vault is empty. Common starting categories you may use: ${SEED_CATEGORIES.join(
      ', ',
    )}. Invent a concise subcategory that fits.`;
  }
  const lines = cats.map((c) => {
    const subs = (c.subcategories ?? []).filter(Boolean);
    return `- ${c.name}${subs.length ? ` (subcategories: ${subs.join(', ')})` : ''}`;
  });
  return `The user ALREADY has these categories and subcategories:\n${lines.join(
    '\n',
  )}\n\nReuse an existing category AND subcategory whenever the content reasonably fits one (match the exact spelling). Only invent a NEW category or subcategory when nothing existing fits — keep new names short, Title Case, and reusable (prefer a durable theme like "Productivity" over a one-off).`;
}

function buildPrompt(taxonomy?: Taxonomy): string {
  return `You are the extraction engine for "Memory Vault", a life-organizer that turns saved screenshots, links, reels and notes into an actionable, well-sorted library.
Pull out REAL, structured, actionable information — never just a vague summary.

${taxonomyBlock(taxonomy)}

Respond ONLY as a single JSON object with these top-level keys:
- "category": the best top-level category (existing one if it fits, else a new short Title Case name).
- "subcategory": a more specific second level under that category (existing one if it fits, else a new short Title Case name). Never empty — use "General" only as a last resort.
- "summary": one concise sentence describing the content.
- "tags": string[] of 2-6 short lowercase topical tags.
- "priority": integer 1-3 for how urgently the user should act on this — 3 = act soon / time-sensitive, 2 = worth doing, 1 = someday / reference. Base it on actionability and time-sensitivity.
- "extracted_links": array of { "url": string, "label": string } for EVERY URL you can find (including links visible as text inside an image/screenshot). ALSO, whenever the content NAMES specific YouTube videos, channels, or creators without giving a direct link, add a YouTube link for each so the user can go watch it: use a YouTube SEARCH url of the form "https://www.youtube.com/results?search_query=" followed by the URL-encoded video/channel name, with a label naming it (e.g. label "3Blue1Brown"). Do NOT invent exact video IDs or watch URLs — only use real URLs that actually appear in the content, otherwise the search-url form. Deduplicate. Empty array if none.
- "spark_score": integer 0-100 rating novelty + potential impact. ONLY set this when "structured_data.kind" is "idea"; otherwise null.
- "structured_data": an object whose "kind" is ONE of: ${STRUCTURED_KINDS.join(
    ', ',
  )} — or null if none fit. The kind is chosen by content TYPE and is independent of the category. Omit fields you cannot determine; never invent facts.

structured_data shapes by kind:
- idea: { "kind":"idea", "headline", "one_liner", "problem", "audience", "next_action", "ten_x", "related": string[] }
- recipe: { "kind":"recipe", "title", "servings", "prep_time", "cook_time", "total_time", "cuisine", "ingredients": string[], "steps": string[], "source_url", "notes" }
- movie: { "kind":"movie", "title", "year", "genre", "director", "where_to_watch", "synopsis", "why_save" }
- repo: { "kind":"repo", "name", "owner", "description", "language", "stars", "url", "use_case" }
- article: { "kind":"article", "headline", "author", "site", "published", "reading_time", "tldr": string[], "key_points": string[], "url" }
- travel: { "kind":"travel", "place", "country", "region", "best_season", "highlights": string[], "est_budget", "map_query" }
- product: { "kind":"product", "product", "brand", "price", "retailer", "url", "pros": string[], "cons": string[] }
- reel: { "kind":"reel", "platform", "title", "author", "caption", "thumbnail_url", "url", "summary", "action_items": string[] (what to actually do or learn from it) }

Use kind "reel" for short-form videos from TikTok, Instagram Reels, or YouTube. Use "article" for readable articles/news. Use null when no card type fits.`;
}

// Build the taxonomy structure the prompt wants from raw (category, subcategory)
// rows already filed in the vault.
export function buildTaxonomy(
  rows: { category?: string | null; subcategory?: string | null }[],
): Taxonomy {
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    const c = (r.category ?? '').trim();
    if (!c) continue;
    const sub = (r.subcategory ?? '').trim();
    if (!map.has(c)) map.set(c, new Set());
    if (sub) map.get(c)!.add(sub);
  }
  return {
    categories: [...map.entries()].map(([name, subs]) => ({
      name,
      subcategories: [...subs],
    })),
  };
}

async function chatJSON(
  openaiKey: string,
  messages: unknown[],
  maxTokens = 900,
): Promise<any> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
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

// A bare URL regex as a safety net to catch links the model missed in plain text.
const URL_RE = /https?:\/\/[^\s"'<>)\]]+/gi;

function harvestUrls(text: string | undefined): { url: string; label?: string }[] {
  if (!text) return [];
  const found = text.match(URL_RE) ?? [];
  return found.map((u) => ({ url: u.replace(/[.,;]+$/, '') }));
}

// Snap a model-returned name to an existing taxonomy entry when it matches
// case-insensitively, so "ai news" reuses "AI News" instead of forking it.
function snap(name: string, existing: string[]): string {
  const hit = existing.find((e) => e.toLowerCase() === name.toLowerCase());
  return hit ?? name;
}

function cleanName(v: unknown): string {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
}

// Normalize whatever the model returned into a strict ExtractionResult, merging
// in any URLs found by the regex safety net and deduplicating.
function normalize(
  raw: any,
  opts: { extraSourceText?: string; taxonomy?: Taxonomy; seed?: Partial<Record<string, unknown>> } = {},
): ExtractionResult {
  const { extraSourceText, taxonomy, seed } = opts;

  const existingCats = (taxonomy?.categories ?? []).map((c) => c.name);
  let category = cleanName(raw?.category) || 'Other';
  category = snap(category, existingCats);

  const existingSubs =
    taxonomy?.categories?.find((c) => c.name.toLowerCase() === category.toLowerCase())
      ?.subcategories ?? [];
  let subcategory = cleanName(raw?.subcategory) || 'General';
  subcategory = snap(subcategory, existingSubs);

  const modelLinks: { url: string; label?: string }[] = Array.isArray(raw?.extracted_links)
    ? raw.extracted_links
        .filter((l: any) => l && typeof l.url === 'string' && /^https?:\/\//i.test(l.url))
        .map((l: any) => ({ url: l.url, label: typeof l.label === 'string' ? l.label : undefined }))
    : [];

  const seen = new Set<string>();
  const extracted_links: { url: string; label?: string }[] = [];
  for (const l of [...modelLinks, ...harvestUrls(extraSourceText)]) {
    const key = l.url.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    extracted_links.push(l);
  }

  // structured_data.kind must be one of the known renderers; drop anything else.
  let structured_data: Record<string, unknown> | null =
    raw?.structured_data &&
    typeof raw.structured_data === 'object' &&
    !Array.isArray(raw.structured_data)
      ? raw.structured_data
      : null;
  if (structured_data && !(STRUCTURED_KINDS as readonly string[]).includes(structured_data.kind as string)) {
    structured_data = null;
  }

  // Merge any caller-provided seed fields (e.g. reel thumbnail/platform we fetched
  // ourselves) into a reel card without overwriting what the model determined.
  if (structured_data && seed && structured_data.kind === 'reel') {
    for (const [k, v] of Object.entries(seed)) {
      if (v != null && structured_data[k] == null) structured_data[k] = v;
    }
  }

  let spark_score: number | null = null;
  if (structured_data?.kind === 'idea' && typeof raw?.spark_score === 'number') {
    spark_score = Math.max(0, Math.min(100, Math.round(raw.spark_score)));
  }

  let priority: number | null = null;
  if (typeof raw?.priority === 'number') {
    priority = Math.max(1, Math.min(3, Math.round(raw.priority)));
  }

  const tags = Array.isArray(raw?.tags) ? raw.tags.filter((t: any) => typeof t === 'string') : [];

  return {
    ai_metadata: {
      summary: typeof raw?.summary === 'string' ? raw.summary : undefined,
      suggested_categories: [category],
      suggested_tags: tags,
    },
    category,
    subcategory,
    structured_data,
    extracted_links,
    spark_score,
    priority,
  };
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

// ---------------------------------------------------------------------------
// Link enrichment: turn a bare URL into real context (caption/author/thumbnail).
// ---------------------------------------------------------------------------

export interface LinkContext {
  platform?: string;
  title?: string;
  author?: string;
  caption?: string;
  thumbnail_url?: string;
  isVideo: boolean;
  text: string; // human-readable blob fed to the model
}

function platformOf(url: string): { name?: string; isVideo: boolean } {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return { isVideo: false };
  }
  if (host.includes('tiktok.com')) return { name: 'TikTok', isVideo: true };
  if (host.includes('instagram.com')) return { name: 'Instagram', isVideo: true };
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be')
    return { name: 'YouTube', isVideo: true };
  if (host.includes('github.com')) return { name: 'GitHub', isVideo: false };
  return { isVideo: false };
}

function metaTag(html: string, prop: string): string | undefined {
  // Match <meta property="og:title" content="..."> in either attribute order.
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
    'i',
  );
  const m = html.match(re);
  if (m) return decodeHtml(m[1]);
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    'i',
  );
  const m2 = html.match(re2);
  return m2 ? decodeHtml(m2[1]) : undefined;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 MemoryVaultBot' } });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 MemoryVaultBot' } });
    if (!resp.ok) return null;
    const text = await resp.text();
    return text.slice(0, 200_000); // cap; og: tags live in <head>
  } catch {
    return null;
  }
}

// Best-effort: official oEmbed for YouTube/TikTok, Open-Graph scrape otherwise.
// Never throws — on failure we still classify from the bare URL.
export async function fetchLinkContext(url: string, title?: string): Promise<LinkContext> {
  const { name: platform, isVideo } = platformOf(url);
  const ctx: LinkContext = { platform, isVideo, text: '' };

  try {
    if (platform === 'YouTube') {
      const j = await fetchJson(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
      );
      if (j) {
        ctx.title = j.title;
        ctx.author = j.author_name;
        ctx.thumbnail_url = j.thumbnail_url;
      }
    } else if (platform === 'TikTok') {
      const j = await fetchJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      if (j) {
        ctx.title = j.title;
        ctx.caption = j.title;
        ctx.author = j.author_name;
        ctx.thumbnail_url = j.thumbnail_url;
      }
    }

    // Fall back to / supplement with Open-Graph tags from the page itself.
    if (!ctx.title || !ctx.thumbnail_url) {
      const html = await fetchHtml(url);
      if (html) {
        ctx.title = ctx.title || metaTag(html, 'og:title');
        ctx.caption = ctx.caption || metaTag(html, 'og:description');
        ctx.thumbnail_url = ctx.thumbnail_url || metaTag(html, 'og:image');
        ctx.author = ctx.author || metaTag(html, 'og:site_name');
      }
    }
  } catch {
    // ignore — partial context is fine
  }

  const parts = [
    `URL: ${url}`,
    platform ? `Platform: ${platform}` : '',
    ctx.title ? `Title: ${ctx.title}` : title ? `Title: ${title}` : '',
    ctx.author ? `Author/Channel: ${ctx.author}` : '',
    ctx.caption ? `Caption/Description: ${ctx.caption}` : '',
  ].filter(Boolean);
  ctx.text = parts.join('\n');
  return ctx;
}

// ---------------------------------------------------------------------------

async function analyzeText(
  openaiKey: string,
  input: string,
  taxonomy?: Taxonomy,
  seed?: Record<string, unknown>,
): Promise<ExtractionResult> {
  const raw = await chatJSON(openaiKey, [
    { role: 'user', content: `${buildPrompt(taxonomy)}\n\n--- CONTENT ---\n${input}` },
  ]);
  return normalize(raw, { extraSourceText: input, taxonomy, seed });
}

async function analyzeImage(
  openaiKey: string,
  memory: MemoryInput,
  supabase: any,
  taxonomy?: Taxonomy,
): Promise<ExtractionResult> {
  if (!memory.storage_path) throw new Error('Image memory has no storage_path');

  const { data: imageData, error } = await supabase.storage
    .from('memories')
    .download(memory.storage_path);
  if (error) throw error;

  const bytes = new Uint8Array(await imageData.arrayBuffer());
  const dataUrl = `data:${mimeFromPath(memory.storage_path)};base64,${toBase64(bytes)}`;

  const raw = await chatJSON(openaiKey, [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `${buildPrompt(taxonomy)}\n\nAlso transcribe any visible text in the image and use it for extraction (especially URLs).`,
        },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ]);
  // No reliable source text for the regex net here; the model handles in-image URLs.
  return normalize(raw, { extraSourceText: memory.title, taxonomy });
}

async function transcribeAudio(
  openaiKey: string,
  memory: MemoryInput,
  supabase: any,
  taxonomy?: Taxonomy,
): Promise<ExtractionResult> {
  if (!memory.storage_path) throw new Error('Voice memo has no storage_path');

  const { data: audioData, error } = await supabase.storage
    .from('memories')
    .download(memory.storage_path);
  if (error) throw error;

  const form = new FormData();
  form.append('file', audioData, 'audio.m4a');
  form.append('model', 'whisper-1');

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  });
  if (!resp.ok) {
    throw new Error(`OpenAI transcription error ${resp.status}: ${await resp.text()}`);
  }
  const { text: transcript } = await resp.json();

  const result = await analyzeText(openaiKey, `Voice memo transcript: "${transcript}"`, taxonomy);
  result.ai_metadata.transcript = transcript;
  return result;
}

async function analyzeLink(
  openaiKey: string,
  memory: MemoryInput,
  taxonomy?: Taxonomy,
): Promise<ExtractionResult> {
  const url = memory.url ?? '';
  const ctx = await fetchLinkContext(url, memory.title ?? memory.content_text);
  // For short-form video, pre-seed the reel card with what we fetched so the
  // thumbnail/platform survive even if the model omits them.
  const seed = ctx.isVideo
    ? {
        platform: ctx.platform,
        author: ctx.author,
        thumbnail_url: ctx.thumbnail_url,
        url,
      }
    : undefined;
  const content =
    ctx.text || `URL: ${url}\nTitle: ${memory.title ?? memory.content_text ?? 'Unknown'}`;
  return analyzeText(openaiKey, content, taxonomy, seed);
}

// Dispatch by memory type. Returns the full structured ExtractionResult.
export async function extractMemory(
  openaiKey: string,
  memory: MemoryInput,
  supabase: any,
  taxonomy?: Taxonomy,
): Promise<ExtractionResult> {
  switch (memory.type) {
    case 'screenshot':
    case 'photo':
      return analyzeImage(openaiKey, memory, supabase, taxonomy);
    case 'voice_memo':
      return transcribeAudio(openaiKey, memory, supabase, taxonomy);
    case 'link':
      return analyzeLink(openaiKey, memory, taxonomy);
    case 'note':
      return analyzeText(
        openaiKey,
        `Note: ${memory.content_text ?? memory.title ?? '(empty)'}`,
        taxonomy,
      );
    case 'video':
      // No video transcription pipeline yet; record minimal metadata.
      return {
        ai_metadata: {
          summary: memory.title ?? 'Video memory',
          suggested_categories: ['Other'],
          suggested_tags: [],
        },
        category: 'Other',
        subcategory: 'General',
        structured_data: null,
        extracted_links: harvestUrls(memory.url),
        spark_score: null,
        priority: null,
      };
    default:
      throw new Error(`Unsupported memory type: ${memory.type}`);
  }
}

// ---------------------------------------------------------------------------
// Taxonomy reconciliation: merge near-duplicate categories/subcategories.
// ---------------------------------------------------------------------------

export interface TaxonomyPair {
  category: string;
  subcategory: string;
  count: number;
}

// A single rename to apply: rows matching (from_category, from_subcategory) become
// (to_category, to_subcategory).
export interface TaxonomyMapping {
  from_category: string;
  from_subcategory: string;
  to_category: string;
  to_subcategory: string;
}

// Ask the model which existing (category, subcategory) pairs are duplicates/
// synonyms and how to collapse them. Returns ONLY the pairs that should change.
export async function reconcileTaxonomy(
  openaiKey: string,
  pairs: TaxonomyPair[],
): Promise<TaxonomyMapping[]> {
  if (pairs.length < 2) return [];

  const list = pairs
    .map((p) => `- category="${p.category}" | subcategory="${p.subcategory}" | items=${p.count}`)
    .join('\n');

  const prompt = `You are tidying a personal knowledge vault's taxonomy. Below are the user's current (category, subcategory) pairs with item counts. Some are near-duplicates or synonyms (e.g. "AI" vs "AI News", "Travel" vs "Travel Ideas", "Recipe" vs "Recipes").

Merge clear duplicates/synonyms into ONE canonical name each, preferring the variant with more items (or the cleaner Title Case name). Do NOT merge things that are genuinely distinct. Be conservative.

Respond ONLY as JSON: { "mappings": [ { "from_category", "from_subcategory", "to_category", "to_subcategory" } ] }. Include an entry ONLY when the pair should change (from != to). Empty array if nothing should change.

Current pairs:
${list}`;

  const raw = await chatJSON(openaiKey, [{ role: 'user', content: prompt }], 1200);
  const out: TaxonomyMapping[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw?.mappings)) {
    for (const m of raw.mappings) {
      const fc = cleanName(m?.from_category);
      const fs = cleanName(m?.from_subcategory);
      const tc = cleanName(m?.to_category);
      const ts = cleanName(m?.to_subcategory);
      if (!fc || !tc) continue;
      if (fc === tc && fs === ts) continue; // no-op
      const key = `${fc} ${fs}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        from_category: fc,
        from_subcategory: fs || 'General',
        to_category: tc,
        to_subcategory: ts || 'General',
      });
    }
  }
  return out;
}
