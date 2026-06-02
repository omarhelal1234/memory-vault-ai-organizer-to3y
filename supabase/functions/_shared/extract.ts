// Shared structured-extraction engine for both Edge Functions
// (analyze-memory + process-my-memories).
//
// Given a memory, it asks OpenAI to:
//   1. Classify it into one canonical category.
//   2. Extract REAL, category-specific structured data
//      (recipe ingredients/steps, article TL;DR, product price, idea next-action, ...).
//   3. Pull every URL out of the content (incl. text inside screenshots).
//   4. Score captured ideas 0-100 on novelty/impact.
//
// The return shape is written across the new memory columns; `ai_metadata` is
// kept populated for backward compatibility with older clients.

const CHAT_MODEL = 'gpt-4o';

export interface MemoryInput {
  id: string;
  type: string;
  storage_path?: string;
  url?: string;
  content_text?: string;
  title?: string;
}

export interface ExtractionResult {
  // Legacy shape (kept for backward compatibility with existing UI/api).
  ai_metadata: {
    summary?: string;
    suggested_categories?: string[];
    suggested_tags?: string[];
    transcript?: string;
  };
  // New structured columns.
  category: string;
  structured_data: Record<string, unknown> | null;
  extracted_links: { url: string; label?: string }[];
  spark_score: number | null;
}

const CATEGORIES = [
  'Ideas',
  'Recipes',
  'Movies to Watch',
  'GitHub Repos',
  'AI News',
  'Travel Ideas',
  'Shopping',
  'Other',
] as const;

// The instruction block shared by every text/vision call. It describes the
// canonical categories AND the per-category `structured_data` schema so the
// model returns rich, typed fields instead of a flat blob.
const EXTRACTION_PROMPT = `You are the extraction engine for "Memory Vault", a life-changing ideas collector.
Pull out REAL, structured, actionable information — never just a vague summary.

Classify the content into exactly ONE category: ${CATEGORIES.join(', ')}.

Respond ONLY as a single JSON object with these top-level keys:
- "category": one of the categories above.
- "summary": one concise sentence describing the content.
- "tags": string[] of 2-6 short lowercase topical tags.
- "extracted_links": array of { "url": string, "label": string } for EVERY URL you can find in the content, including links visible as text inside an image/screenshot. Deduplicate. Empty array if none.
- "spark_score": integer 0-100 rating novelty + potential impact. ONLY set this when category is "Ideas"; otherwise null.
- "structured_data": an object whose shape depends on the category (see below). Use null only for "Other". Omit fields you genuinely cannot determine; never invent facts.

structured_data shapes by category:
- Ideas: { "kind":"idea", "headline", "one_liner", "problem", "audience", "next_action", "ten_x" (what would make it 10x bigger), "related": string[] }
- Recipes: { "kind":"recipe", "title", "servings", "prep_time", "cook_time", "total_time", "cuisine", "ingredients": string[], "steps": string[] (numbered cooking steps), "source_url", "notes" }
- Movies to Watch: { "kind":"movie", "title", "year", "genre", "director", "where_to_watch", "synopsis", "why_save" }
- GitHub Repos: { "kind":"repo", "name", "owner", "description", "language", "stars", "url", "use_case" }
- AI News: { "kind":"article", "headline", "author", "site", "published", "reading_time", "tldr": string[] (2-4 bullets), "key_points": string[], "url" }
- Travel Ideas: { "kind":"travel", "place", "country", "region", "best_season", "highlights": string[], "est_budget", "map_query" }
- Shopping: { "kind":"product", "product", "brand", "price", "retailer", "url", "pros": string[], "cons": string[] }
- Other: null, OR { "kind":"article", ... } (same fields as AI News) when the content is readable article-like text.

If a plain link or article doesn't fit Recipes/Repos/Movies/Travel/Shopping, classify it as "AI News" only if it's genuinely tech/AI; otherwise use "Other" (with an article card if it's readable, else null structured_data).`;

// The structured_data.kind that is valid for each category. Anything the model
// returns that doesn't match is dropped, so category and card never disagree.
const KIND_BY_CATEGORY: Record<string, string> = {
  Ideas: 'idea',
  Recipes: 'recipe',
  'Movies to Watch': 'movie',
  'GitHub Repos': 'repo',
  'AI News': 'article',
  'Travel Ideas': 'travel',
  Shopping: 'product',
  // "Other" is special-cased below: only 'article' or null is allowed.
};

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

// Normalize whatever the model returned into a strict ExtractionResult, merging
// in any URLs found by the regex safety net and deduplicating.
function normalize(raw: any, extraSourceText?: string): ExtractionResult {
  const category =
    typeof raw?.category === 'string' && (CATEGORIES as readonly string[]).includes(raw.category)
      ? raw.category
      : 'Other';

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

  let spark_score: number | null = null;
  if (category === 'Ideas' && typeof raw?.spark_score === 'number') {
    spark_score = Math.max(0, Math.min(100, Math.round(raw.spark_score)));
  }

  // Enforce that structured_data.kind matches the category, so filtering and the
  // UI switch never disagree with the classification. Drop mismatches to null.
  let structured_data: Record<string, unknown> | null =
    raw?.structured_data && typeof raw.structured_data === 'object' && !Array.isArray(raw.structured_data)
      ? raw.structured_data
      : null;
  if (structured_data) {
    const kind = structured_data.kind;
    const allowed = category === 'Other' ? 'article' : KIND_BY_CATEGORY[category];
    if (kind !== allowed) structured_data = null;
  }

  const tags = Array.isArray(raw?.tags) ? raw.tags.filter((t: any) => typeof t === 'string') : [];

  return {
    ai_metadata: {
      summary: typeof raw?.summary === 'string' ? raw.summary : undefined,
      suggested_categories: [category],
      suggested_tags: tags,
    },
    category,
    structured_data,
    extracted_links,
    spark_score,
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

async function analyzeText(openaiKey: string, input: string): Promise<ExtractionResult> {
  const raw = await chatJSON(openaiKey, [
    { role: 'user', content: `${EXTRACTION_PROMPT}\n\n--- CONTENT ---\n${input}` },
  ]);
  return normalize(raw, input);
}

async function analyzeImage(
  openaiKey: string,
  memory: MemoryInput,
  supabase: any,
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
          text: `${EXTRACTION_PROMPT}\n\nAlso transcribe any visible text in the image and use it for extraction (especially URLs).`,
        },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ]);
  // No reliable source text for the regex net here; the model handles in-image URLs.
  return normalize(raw, memory.title);
}

async function transcribeAudio(
  openaiKey: string,
  memory: MemoryInput,
  supabase: any,
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

  const result = await analyzeText(openaiKey, `Voice memo transcript: "${transcript}"`);
  result.ai_metadata.transcript = transcript;
  return result;
}

// Dispatch by memory type. Returns the full structured ExtractionResult.
export async function extractMemory(
  openaiKey: string,
  memory: MemoryInput,
  supabase: any,
): Promise<ExtractionResult> {
  switch (memory.type) {
    case 'screenshot':
    case 'photo':
      return analyzeImage(openaiKey, memory, supabase);
    case 'voice_memo':
      return transcribeAudio(openaiKey, memory, supabase);
    case 'link':
      return analyzeText(
        openaiKey,
        `URL: ${memory.url ?? 'Unknown'}\nTitle: ${memory.title ?? memory.content_text ?? 'Unknown'}`,
      );
    case 'note':
      return analyzeText(openaiKey, `Note: ${memory.content_text ?? memory.title ?? '(empty)'}`);
    case 'video':
      // No video transcription pipeline yet; record minimal metadata.
      return {
        ai_metadata: {
          summary: memory.title ?? 'Video memory',
          suggested_categories: ['Other'],
          suggested_tags: [],
        },
        category: 'Other',
        structured_data: null,
        extracted_links: harvestUrls(memory.url) ,
        spark_score: null,
      };
    default:
      throw new Error(`Unsupported memory type: ${memory.type}`);
  }
}
