-- Every owner reference deletes what it owns.
--
-- `section` already cascaded from both of its owners (#92); `work`, `school`,
-- `contact`, `skill` and `resume` did not, so the same ownership relation had
-- two different delete policies depending on the table. Deleting a resume now
-- takes its snapshot rows with it, and deleting an account takes its master
-- rows and its resumes — rather than the resume delete cleaning up by hand in
-- application code and the account delete being blocked by the foreign key.
--
-- A master copy is spelled with `resume_id` null, so no cascade from a resume
-- can reach one. Rewriting a constraint is a drop and an add: brief ACCESS
-- EXCLUSIVE locks on small tables, and the add revalidates rows that already
-- satisfy the same reference.
--
-- The two indexes are the ones Postgres does not create for us. Nothing
-- indexed `section`'s owner columns, which every read of a section filters on.
ALTER TABLE "apply-ai_contact" DROP CONSTRAINT "apply-ai_contact_resume_id_apply-ai_resume_id_fk";
--> statement-breakpoint
ALTER TABLE "apply-ai_resume" DROP CONSTRAINT "apply-ai_resume_user_id_apply-ai_user_id_fk";
--> statement-breakpoint
ALTER TABLE "apply-ai_school" DROP CONSTRAINT "apply-ai_school_user_id_apply-ai_user_id_fk";
--> statement-breakpoint
ALTER TABLE "apply-ai_school" DROP CONSTRAINT "apply-ai_school_resume_id_apply-ai_resume_id_fk";
--> statement-breakpoint
ALTER TABLE "apply-ai_skill" DROP CONSTRAINT "apply-ai_skill_user_id_apply-ai_user_id_fk";
--> statement-breakpoint
ALTER TABLE "apply-ai_work" DROP CONSTRAINT "apply-ai_work_user_id_apply-ai_user_id_fk";
--> statement-breakpoint
ALTER TABLE "apply-ai_work" DROP CONSTRAINT "apply-ai_work_resume_id_apply-ai_resume_id_fk";
--> statement-breakpoint
ALTER TABLE "apply-ai_contact" ADD CONSTRAINT "apply-ai_contact_resume_id_apply-ai_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."apply-ai_resume"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_resume" ADD CONSTRAINT "apply-ai_resume_user_id_apply-ai_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."apply-ai_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_school" ADD CONSTRAINT "apply-ai_school_user_id_apply-ai_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."apply-ai_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_school" ADD CONSTRAINT "apply-ai_school_resume_id_apply-ai_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."apply-ai_resume"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_skill" ADD CONSTRAINT "apply-ai_skill_user_id_apply-ai_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."apply-ai_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_work" ADD CONSTRAINT "apply-ai_work_user_id_apply-ai_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."apply-ai_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_work" ADD CONSTRAINT "apply-ai_work_resume_id_apply-ai_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."apply-ai_resume"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "section_resume_id_idx" ON "apply-ai_section" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "section_user_id_idx" ON "apply-ai_section" USING btree ("user_id");