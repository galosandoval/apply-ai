CREATE TABLE "apply-ai_section" (
	"id" text PRIMARY KEY NOT NULL,
	"resume_id" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"component_type" text NOT NULL,
	"position" integer NOT NULL,
	"content" jsonb
);
--> statement-breakpoint
ALTER TABLE "apply-ai_contact" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "apply-ai_contact" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "apply-ai_contact" ADD COLUMN "resume_id" text;--> statement-breakpoint
ALTER TABLE "apply-ai_resume" ADD COLUMN "job_description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_school" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_skill" ADD COLUMN "resume_id" text;--> statement-breakpoint
ALTER TABLE "apply-ai_work" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_section" ADD CONSTRAINT "apply-ai_section_resume_id_apply-ai_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."apply-ai_resume"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_contact" ADD CONSTRAINT "apply-ai_contact_resume_id_apply-ai_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."apply-ai_resume"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_skill" ADD CONSTRAINT "apply-ai_skill_resume_id_apply-ai_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."apply-ai_resume"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- >>> backfill
-- Every existing resume gets the three core sections it was always drawn with,
-- in the order the template hardcoded, so from here on the order is data.
INSERT INTO "apply-ai_section" ("id", "resume_id", "kind", "label", "component_type", "position")
SELECT md5(r."id" || core.kind), r."id", core.kind, core.label, 'twoColumn', core.position
FROM "apply-ai_resume" r
CROSS JOIN (VALUES
  ('skills', 'Skills', 0),
  ('experience', 'Experience', 1),
  ('education', 'Education', 2)
) AS core(kind, label, position);--> statement-breakpoint
-- `introduction` and `interests` become custom rich-text sections: one way to
-- express a block of text on a resume rather than two half-built columns. The
-- resume's own value wins; the account's seeds it when the resume has none.
-- A summary is read first, so it lands before the core sections.
INSERT INTO "apply-ai_section" ("id", "resume_id", "kind", "label", "component_type", "position", "content")
SELECT md5(r."id" || 'introduction'), r."id", 'custom', 'Summary', 'richText', -1,
  jsonb_build_object('markdown', coalesce(nullif(trim(r."introduction"), ''), trim(u."introduction")))
FROM "apply-ai_resume" r
LEFT JOIN "apply-ai_user" u ON u."id" = r."user_id"
WHERE coalesce(nullif(trim(r."introduction"), ''), nullif(trim(u."introduction"), '')) IS NOT NULL;--> statement-breakpoint
INSERT INTO "apply-ai_section" ("id", "resume_id", "kind", "label", "component_type", "position", "content")
SELECT md5(r."id" || 'interests'), r."id", 'custom', 'Interests', 'richText', 3,
  jsonb_build_object('markdown', coalesce(nullif(trim(r."interests"), ''), trim(u."interests")))
FROM "apply-ai_resume" r
LEFT JOIN "apply-ai_user" u ON u."id" = r."user_id"
WHERE coalesce(nullif(trim(r."interests"), ''), nullif(trim(u."interests"), '')) IS NOT NULL;--> statement-breakpoint
-- Snapshot the account's skills onto every resume that was rendering them
-- through. Reading from the table being inserted into is safe: the statement
-- sees the rows as they were when it started, so the copies aren't re-copied.
INSERT INTO "apply-ai_skill" ("id", "category", "all", "position", "user_id", "resume_id")
SELECT md5(r."id" || s."id"), s."category", s."all", s."position", s."user_id", r."id"
FROM "apply-ai_resume" r
JOIN "apply-ai_skill" s ON s."user_id" = r."user_id" AND s."resume_id" IS NULL;--> statement-breakpoint
-- The same for contact, with the name and email the resume was showing frozen
-- onto it — the account changing its name is not an edit to a resume already sent.
INSERT INTO "apply-ai_contact" ("id", "full_name", "email", "phone", "linked_in", "portfolio", "location", "user_id", "resume_id")
SELECT md5(r."id" || c."id"),
  nullif(trim(both ' ' from coalesce(u."first_name", '') || ' ' || coalesce(u."last_name", '')), ''),
  u."email", c."phone", c."linked_in", c."portfolio", c."location", c."user_id", r."id"
FROM "apply-ai_resume" r
JOIN "apply-ai_user" u ON u."id" = r."user_id"
JOIN "apply-ai_contact" c ON c."user_id" = r."user_id" AND c."resume_id" IS NULL;--> statement-breakpoint
-- Row order was `ORDER BY id` — stable but arbitrary. Freeze that order into a
-- real column so a job can be moved without its neighbours moving with it.
UPDATE "apply-ai_work" w SET "position" = ordered.rn
FROM (
  SELECT "id", row_number() OVER (PARTITION BY coalesce("resume_id", "user_id") ORDER BY "id") - 1 AS rn
  FROM "apply-ai_work"
) ordered
WHERE ordered."id" = w."id";--> statement-breakpoint
UPDATE "apply-ai_school" sc SET "position" = ordered.rn
FROM (
  SELECT "id", row_number() OVER (PARTITION BY coalesce("resume_id", "user_id") ORDER BY "id") - 1 AS rn
  FROM "apply-ai_school"
) ordered
WHERE ordered."id" = sc."id";
