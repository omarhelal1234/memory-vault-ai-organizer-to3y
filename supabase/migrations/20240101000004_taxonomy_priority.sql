-- Dynamic taxonomy + prioritization upgrade
--
-- The app moved from a fixed 8-category enum to a fully dynamic, LLM-driven
-- taxonomy with two levels (category -> subcategory) plus per-item priority and a
-- done flag so captures can be triaged like a to-do list. All columns are
-- nullable / defaulted, so this is a non-breaking additive migration; existing
-- rows keep their `category` and simply have NULL subcategory/priority.

ALTER TABLE memories
  -- Free-form second level under `category`. Both are now AI-invented strings
  -- (reused across captures when one fits), not constrained to a fixed list.
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  -- Triage priority the AI assigns: 1 = low / someday, 2 = medium, 3 = high / do soon.
  ADD COLUMN IF NOT EXISTS priority SMALLINT
    CHECK (priority IS NULL OR (priority >= 1 AND priority <= 3)),
  -- User checkbox so a capture can be marked handled and drop out of the to-do views.
  ADD COLUMN IF NOT EXISTS done BOOLEAN NOT NULL DEFAULT FALSE;

-- Drill-down navigation groups by (category, subcategory); index both levels.
CREATE INDEX IF NOT EXISTS memories_subcategory_idx
  ON memories(user_id, category, subcategory);

-- Surface the most urgent, not-yet-done captures first.
CREATE INDEX IF NOT EXISTS memories_priority_idx
  ON memories(user_id, priority DESC) WHERE done = FALSE AND priority IS NOT NULL;
