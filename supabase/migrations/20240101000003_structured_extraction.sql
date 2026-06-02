-- Structured extraction upgrade
-- Adds typed, category-specific extraction fields so the AI can pull REAL
-- information (recipes, articles, products, ideas, ...) instead of a flat summary.
--
-- All columns are nullable and backfill to NULL on existing rows, so this is a
-- non-breaking, additive migration. The legacy `ai_metadata` column is kept for
-- backward compatibility (summary / suggested_categories / suggested_tags).

ALTER TABLE memories
  -- Single denormalized primary category for fast grouping/filtering in the feed.
  ADD COLUMN IF NOT EXISTS category TEXT,
  -- Category-specific extracted fields. Shape depends on `category`
  -- (recipe -> ingredients/steps, article -> tldr/key_points, idea -> next_action, ...).
  ADD COLUMN IF NOT EXISTS structured_data JSONB,
  -- Deduplicated, tappable URLs pulled out of screenshots / notes / links.
  -- Array of { url: text, label: text }.
  ADD COLUMN IF NOT EXISTS extracted_links JSONB,
  -- 0-100 novelty/impact score the AI assigns to captured ideas. NULL for non-ideas.
  ADD COLUMN IF NOT EXISTS spark_score INTEGER
    CHECK (spark_score IS NULL OR (spark_score >= 0 AND spark_score <= 100));

-- Group/filter the feed by category cheaply.
CREATE INDEX IF NOT EXISTS memories_category_idx ON memories(user_id, category);

-- Surface the best ideas first.
CREATE INDEX IF NOT EXISTS memories_spark_score_idx
  ON memories(user_id, spark_score DESC) WHERE spark_score IS NOT NULL;
