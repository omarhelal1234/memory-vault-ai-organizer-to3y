-- Backfill: canonicalize the empty subcategory to 'General'
--
-- Migration 0004 added `subcategory` as nullable, so completed rows captured
-- before the extraction engine started defaulting it carry NULL. The reconcile
-- (auto-organize) pass builds its (category, subcategory) pairs by coalescing
-- NULL -> 'General', then issues an UPDATE keyed on subcategory = 'General',
-- which never matched the NULL rows. The merge therefore reported rowsMoved = 0
-- and effectively split a category in two.
--
-- The extraction engine now always writes 'General' (never NULL), so this is a
-- one-time cleanup of legacy rows. Idempotent and non-breaking.

UPDATE memories
  SET subcategory = 'General'
  WHERE subcategory IS NULL
    AND category IS NOT NULL;
