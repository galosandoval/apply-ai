-- An entry's body becomes one markdown field.
--
-- `work.bullets` and `school.description` were the same field with two types —
-- "the text under this entry" — and neither let a user mix a paragraph with a
-- list. Both become `body`, holding the constrained markdown subset the app
-- already renders (`src/lib/resume-markdown.tsx`): bold, links, bullet lists.
--
-- Added here and backfilled in 0013, which is also where the old columns go:
-- the two steps are separate files only because the column that is dropped and
-- the column that replaces it cannot be told apart by a schema diff.
ALTER TABLE "apply-ai_school" ADD COLUMN "body" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_work" ADD COLUMN "body" text DEFAULT '' NOT NULL;
