CREATE TABLE IF NOT EXISTS "gptJob_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"urls" text[] NOT NULL,
	"location" text NOT NULL,
	"profile_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gptJob_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"profession" text,
	"skills" text[],
	"profile" text,
	"interests" text,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gptJob_resume" (
	"id" text PRIMARY KEY NOT NULL,
	"job_description" text NOT NULL,
	"profession" text NOT NULL,
	"skills" text NOT NULL,
	"introduction" text,
	"interests" text,
	"experience" text NOT NULL,
	"education" text NOT NULL,
	"contact" text NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gptJob_school" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"degree" text NOT NULL,
	"location" text,
	"gpa" text,
	"description" text,
	"profile_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gptJob_user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"image" text,
	"password" text NOT NULL,
	"is_onboarded" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gptJob_work" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"profile_id" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gptJob_resume" ADD CONSTRAINT "gptJob_resume_user_id_gptJob_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "gptJob_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
