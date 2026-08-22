CREATE TABLE IF NOT EXISTS "apply-ai_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text,
	"linked_in" text,
	"portfolio" text,
	"location" text NOT NULL,
	"profile_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apply-ai_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"profession" text DEFAULT '' NOT NULL,
	"profile" text,
	"interests" text,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apply-ai_resume" (
	"id" text PRIMARY KEY NOT NULL,
	"profession" text NOT NULL,
	"introduction" text,
	"interests" text,
	"profile_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apply-ai_school" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"degree" text NOT NULL,
	"location" text,
	"gpa" text,
	"description" text,
	"profile_id" text,
	"resume_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apply-ai_skill" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"all" text[] NOT NULL,
	"position" integer NOT NULL,
	"profile_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apply-ai_user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"image" text,
	"password" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apply-ai_work" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"description" text NOT NULL,
	"profile_id" text,
	"resume_id" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apply-ai_profile" ADD CONSTRAINT "apply-ai_profile_user_id_apply-ai_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "apply-ai_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apply-ai_resume" ADD CONSTRAINT "apply-ai_resume_profile_id_apply-ai_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "apply-ai_profile"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apply-ai_school" ADD CONSTRAINT "apply-ai_school_profile_id_apply-ai_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "apply-ai_profile"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apply-ai_school" ADD CONSTRAINT "apply-ai_school_resume_id_apply-ai_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "apply-ai_resume"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apply-ai_skill" ADD CONSTRAINT "apply-ai_skill_profile_id_apply-ai_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "apply-ai_profile"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apply-ai_work" ADD CONSTRAINT "apply-ai_work_profile_id_apply-ai_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "apply-ai_profile"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apply-ai_work" ADD CONSTRAINT "apply-ai_work_resume_id_apply-ai_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "apply-ai_resume"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
