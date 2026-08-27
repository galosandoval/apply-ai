-- Skills stops being a core section and becomes a content-bearing one.
--
-- A core section is a label, an order and a pointer to its own typed rows, and
-- those rows are what make a resume machine-readable. A skill category was
-- never that: it is a way of arranging short strings, which is what the
-- `groupedList` shape is for. So the resume's snapshotted `skill` rows move
-- into the section's own `content`, and the section joins the ones a user can
-- add from the catalog.
--
-- The account's master copy — `skill` rows with a null `resume_id` — is
-- untouched. It is still what onboarding writes and what a new resume is
-- snapshotted from.

-- 1. Each resume's skill rows, in order, as the payload the shape stores.
UPDATE "apply-ai_section" AS s
SET
  "component_type" = 'groupedList',
  "content" = COALESCE(
    (
      SELECT jsonb_build_object(
        'groups',
        jsonb_agg(
          jsonb_build_object('label', k."category", 'items', to_jsonb(k."all"))
          ORDER BY k."position", k."id"
        )
      )
      FROM "apply-ai_skill" AS k
      WHERE k."resume_id" = s."resume_id"
    ),
    jsonb_build_object('groups', '[]'::jsonb)
  )
WHERE s."kind" = 'skills';--> statement-breakpoint

-- 2. A section whose content is now its own has no rows left to point at.
DELETE FROM "apply-ai_skill" WHERE "resume_id" IS NOT NULL;--> statement-breakpoint

-- 3. A snapshot column nothing writes is the half-built column this codebase
--    has removed twice before. The master copy is keyed by `user_id` alone.
ALTER TABLE "apply-ai_skill" DROP COLUMN "resume_id";
