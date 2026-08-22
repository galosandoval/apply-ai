ALTER TABLE "apply-ai_work" ADD COLUMN "bullets" text[];--> statement-breakpoint
UPDATE "apply-ai_work" SET "bullets" = COALESCE(
	(
		SELECT array_agg(btrim(part))
		FROM unnest(string_to_array("description", '. ')) AS part
		WHERE btrim(part) <> ''
	),
	ARRAY[]::text[]
);--> statement-breakpoint
ALTER TABLE "apply-ai_work" ALTER COLUMN "bullets" SET NOT NULL;
