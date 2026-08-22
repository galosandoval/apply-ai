ALTER TABLE "apply-ai_profile" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "apply-ai_profile" CASCADE;--> statement-breakpoint
ALTER TABLE "apply-ai_resume" DROP CONSTRAINT IF EXISTS "apply-ai_resume_profile_id_apply-ai_profile_id_fk";
--> statement-breakpoint
ALTER TABLE "apply-ai_school" DROP CONSTRAINT IF EXISTS "apply-ai_school_profile_id_apply-ai_profile_id_fk";
--> statement-breakpoint
ALTER TABLE "apply-ai_skill" DROP CONSTRAINT IF EXISTS "apply-ai_skill_profile_id_apply-ai_profile_id_fk";
--> statement-breakpoint
ALTER TABLE "apply-ai_work" DROP CONSTRAINT IF EXISTS "apply-ai_work_profile_id_apply-ai_profile_id_fk";
--> statement-breakpoint
ALTER TABLE "apply-ai_contact" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "apply-ai_contact" DROP COLUMN "profile_id";--> statement-breakpoint
ALTER TABLE "apply-ai_resume" DROP COLUMN "profile_id";--> statement-breakpoint
ALTER TABLE "apply-ai_school" DROP COLUMN "profile_id";--> statement-breakpoint
ALTER TABLE "apply-ai_skill" DROP COLUMN "profile_id";--> statement-breakpoint
ALTER TABLE "apply-ai_user" DROP COLUMN "password";--> statement-breakpoint
ALTER TABLE "apply-ai_work" DROP COLUMN "profile_id";