// Canonical categories the AI classifies memories into. "Ideas" is first-class:
// Memory Vault is an ideas collector first, a clipboard second.
export const CATEGORIES = [
  'Ideas',
  'Recipes',
  'Movies to Watch',
  'GitHub Repos',
  'AI News',
  'Travel Ideas',
  'Shopping',
  'Other',
] as const;

export type CategoryName = (typeof CATEGORIES)[number];

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

export type StructuredData =
  | RecipeData
  | ArticleData
  | ProductData
  | RepoData
  | MovieData
  | TravelData
  | IdeaData;

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
  structured_data?: StructuredData | null;
  extracted_links?: ExtractedLink[] | null;
  spark_score?: number | null; // 0-100, ideas only
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
