CREATE TABLE "apply-ai_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apply-ai_session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "apply-ai_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "apply-ai_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apply-ai_contact" ALTER COLUMN "profile_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_user" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_contact" ADD COLUMN "user_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_resume" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "apply-ai_school" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "apply-ai_skill" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "apply-ai_user" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_user" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_user" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_user" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_user" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "apply-ai_user" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "apply-ai_user" ADD COLUMN "profession" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_user" ADD COLUMN "introduction" text;--> statement-breakpoint
ALTER TABLE "apply-ai_user" ADD COLUMN "interests" text;--> statement-breakpoint
ALTER TABLE "apply-ai_work" ADD COLUMN "user_id" text;--> statement-breakpoint
-- Carry every profile row onto the user it belonged to. The relation was
-- already 1:1, so there is exactly one source row per user.
UPDATE "apply-ai_user" AS u SET
  "first_name" = p."first_name",
  "last_name" = p."last_name",
  "profession" = p."profession",
  "introduction" = p."profile",
  "interests" = p."interests",
  "name" = trim(both ' ' from coalesce(p."first_name", '') || ' ' || coalesce(p."last_name", ''))
FROM "apply-ai_profile" AS p
WHERE p."user_id" = u."id";--> statement-breakpoint
-- Repoint everything the profile owned at the user directly.
UPDATE "apply-ai_contact" AS c SET "user_id" = p."user_id"
  FROM "apply-ai_profile" AS p WHERE c."profile_id" = p."id" AND p."user_id" IS NOT NULL;--> statement-breakpoint
UPDATE "apply-ai_skill" AS s SET "user_id" = p."user_id"
  FROM "apply-ai_profile" AS p WHERE s."profile_id" = p."id";--> statement-breakpoint
UPDATE "apply-ai_work" AS w SET "user_id" = p."user_id"
  FROM "apply-ai_profile" AS p WHERE w."profile_id" = p."id";--> statement-breakpoint
UPDATE "apply-ai_school" AS sc SET "user_id" = p."user_id"
  FROM "apply-ai_profile" AS p WHERE sc."profile_id" = p."id";--> statement-breakpoint
UPDATE "apply-ai_resume" AS r SET "user_id" = p."user_id"
  FROM "apply-ai_profile" AS p WHERE r."profile_id" = p."id";--> statement-breakpoint
ALTER TABLE "apply-ai_account" ADD CONSTRAINT "apply-ai_account_user_id_apply-ai_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."apply-ai_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_session" ADD CONSTRAINT "apply-ai_session_user_id_apply-ai_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."apply-ai_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_resume" ADD CONSTRAINT "apply-ai_resume_user_id_apply-ai_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."apply-ai_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_school" ADD CONSTRAINT "apply-ai_school_user_id_apply-ai_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."apply-ai_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_skill" ADD CONSTRAINT "apply-ai_skill_user_id_apply-ai_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."apply-ai_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_work" ADD CONSTRAINT "apply-ai_work_user_id_apply-ai_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."apply-ai_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply-ai_user" ADD CONSTRAINT "apply-ai_user_email_unique" UNIQUE("email");