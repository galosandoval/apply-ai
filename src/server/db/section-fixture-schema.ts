/**
 * The tables as the section expand left them, for the migrations that follow it.
 *
 * `0015_section_account_owner.sql` made `section.resume_id` and `section.user_id`
 * both nullable so the table could hold a resume's snapshot and an account's
 * master copy side by side. `0017` (the backfill) and `0018` (the constraint)
 * both run against exactly this state — they are two deploys against one point
 * in the schema's history — so they share one fixture rather than each keeping
 * a copy that could drift from the other.
 *
 * Only what those two migrations read or write is here. A later migration gets
 * its own fixture: the point of these is to be the schema as it stood, not the
 * schema as it is.
 */
export const sectionSchemaAfterExpand = `
  CREATE TABLE "apply-ai_user" (
    "id" text PRIMARY KEY, "email" text NOT NULL,
    "locale" text DEFAULT 'en' NOT NULL
  );
  CREATE TABLE "apply-ai_resume" ("id" text PRIMARY KEY, "user_id" text);
  CREATE TABLE "apply-ai_section" (
    "id" text PRIMARY KEY, "resume_id" text, "user_id" text,
    "kind" text NOT NULL, "label" text NOT NULL,
    "component_type" text NOT NULL, "position" integer NOT NULL,
    "content" jsonb
  );
  CREATE TABLE "apply-ai_skill" (
    "id" text PRIMARY KEY, "category" text NOT NULL, "all" text[] NOT NULL,
    "position" integer NOT NULL, "user_id" text
  );
  CREATE TABLE "apply-ai_work" (
    "id" text PRIMARY KEY, "position" integer DEFAULT 0 NOT NULL,
    "user_id" text, "resume_id" text
  );
  CREATE TABLE "apply-ai_school" (
    "id" text PRIMARY KEY, "position" integer DEFAULT 0 NOT NULL,
    "user_id" text, "resume_id" text
  );
`
