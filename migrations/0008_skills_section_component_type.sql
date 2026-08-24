-- Skills draws as a list, not as two columns.
--
-- Resumes created before spec C stored `twoColumn` for every core section,
-- which was true of the renderer at the time and is not now. Core sections are
-- still dispatched on their `kind`, so nothing renders differently — this is
-- the stored row catching up with what it says it is, so the two cannot drift.
UPDATE "apply-ai_section"
SET "component_type" = 'list'
WHERE "kind" = 'skills' AND "component_type" <> 'list';
