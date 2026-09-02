-- The UI language, on the account, and the language a resume is written in.
--
-- Both default to 'en', which is also the backfill: every row that exists
-- predates the Spanish build, so it is English by definition. `resume.language`
-- is copied from `user.locale` at creation and never re-derived, so no
-- correlated update is needed here.
ALTER TABLE "apply-ai_user" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_resume" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;
