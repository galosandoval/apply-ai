-- A section can be owned by an account, not only by a resume.
--
-- The expand half of an expand-and-contract: `resume_id` relaxes to nullable
-- and a nullable `user_id` joins it, so the table can hold the master copy of a
-- section the same way `contact`, `work` and `school` already hold theirs. What
-- a section *is* does not change — `kind`, `label`, `component_type`,
-- `position` and `content` keep their meanings, and core sections still carry
-- no content.
--
-- Nothing writes `user_id` yet and nothing reads it, so the app behaves exactly
-- as it did before; this exists so the extraction and onboarding work have
-- somewhere to put their results. The check constraint that makes exactly one
-- owner present is deliberately not here: it is the contract step, and adding
-- it before every writer has moved would break the writers that have not. See
-- #92.
ALTER TABLE "apply-ai_section" ALTER COLUMN "resume_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_section" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "apply-ai_section" ADD CONSTRAINT "apply-ai_section_user_id_apply-ai_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."apply-ai_user"("id") ON DELETE cascade ON UPDATE no action;