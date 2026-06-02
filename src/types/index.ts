// SEED categories the AI starts from on an empty vault. The taxonomy is fully
// dynamic: the AI reuses an existing category/subcategory when one fits and only
// invents a new one when nothing does (and a periodic reconcile pass merges
// near-duplicates). So a category is just a string — this list is a starting
// suggestion, not a closed set.
export const SEED_CATEGORIES = [
  'Ideas',
  'Recipes',
  'Watch Later',
  'GitHub Repos',
  'AI News',
  'Travel',
  'Shopping',
  'Other',
] as const;

// Categories/subcategories are free-form strings (AI-invented, user-mergeable).
export type CategoryName = string;

// A URL pulled out of a screenshot, note, or link (deduplicated by the AI).
export type ExtractedLink = {
  url: string;
  label?: string;
};

// ---------------------------------------------------------------------------
// Category-specific structured data. The AI fills exactly one of these shapes
// based on the detected `category`. `kind` is the discriminant.
// ---------------------------------------------------------------------------

export type RecipeData = {
  kind: 'recipe';
  title?: string;
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  total_time?: string;
  cuisine?: string;
  ingredients?: string[];
  steps?: string[];
  source_url?: string;
  notes?: string;
};

export type ArticleData = {
  kind: 'article';
  headline?: string;
  author?: string;
  site?: string;
  published?: string;
  reading_time?: string;
  tldr?: string[];
  key_points?: string[];
  url?: string;
};

export type ProductData = {
  kind: 'product';
  product?: string;
  brand?: string;
  price?: string;
  retailer?: string;
  url?: string;
  pros?: string[];
  cons?: string[];
};

export type RepoData = {
  kind: 'repo';
  name?: string;
  owner?: string;
  description?: string;
  language?: string;
  stars?: string;
  url?: string;
  use_case?: string;
};

export type MovieData = {
  kind: 'movie';
  title?: string;
  year?: string;
  genre?: string;
  director?: string;
  where_to_watch?: string;
  synopsis?: string;
  why_save?: string;
};

export type TravelData = {
  kind: 'travel';
  place?: string;
  country?: string;
  region?: string;
  best_season?: string;
  highlights?: string[];
  est_budget?: string;
  map_query?: string;
};

export type IdeaData = {
  kind: 'idea';
  headline?: string;
  one_liner?: string;
  problem?: string;
  audience?: string;
  next_action?: string;
  ten_x?: string; // what would make this idea 10x bigger
  related?: string[];
};

// A short-form video saved from TikTok / Instagram Reels / YouTube. Populated
// from the link's public oEmbed/Open-Graph metadata, then enriched by the AI.
export type ReelData = {
  kind: 'reel';
  platform?: string; // 'TikTok' | 'Instagram' | 'YouTube' | ...
  title?: string;
  author?: string;
  caption?: string;
  thumbnail_url?: string;
  url?: string;
  summary?: string;
  action_items?: string[]; // what to actually do/learn from it
};

export type StructuredData =
  | RecipeData
  | ArticleData
  | ProductData
  | RepoData
  | MovieData
  | TravelData
  | IdeaData
  | ReelData;

export type Memory = {
  id: string;
  user_id: string;
  type: 'screenshot' | 'voice_memo' | 'photo' | 'video' | 'link' | 'note';
  storage_path?: string;
  content_text?: string;
  url?: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  ai_metadata?: {
    summary?: string;
    suggested_categories?: string[];
    suggested_tags?: string[];
    confidence_scores?: Record<string, number>;
    transcript?: string;
  };
  // Structured extraction (added in migration 20240101000003).
  // Nullable in the DB — Supabase returns null (not undefined) for empty columns.
  category?: string | null;
  // Dynamic second level under `category` (migration 20240101000004).
  subcategory?: string | null;
  structured_data?: StructuredData | null;
  extracted_links?: ExtractedLink[] | null;
  spark_score?: number | null; // 0-100, ideas only
  // Triage priority: 1 = low/someday, 2 = medium, 3 = high/do soon. NULL = unrated.
  priority?: number | null;
  // User checkbox: handled captures drop out of the to-do views.
  done?: boolean;
  title?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  captured_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  icon?: string;
  color?: string;
  parent_id?: string;
  sort_order: number;
  created_at: string;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type UserPreferences = {
  user_id: string;
  preferences: Record<string, any>;
};
