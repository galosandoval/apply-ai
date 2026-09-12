-- A section row has exactly one owner.
--
-- The contract half of the expand-and-contract `0015_section_account_owner.sql`
-- opened: `resume_id` and `user_id` both became nullable so the table could
-- hold a resume's snapshot and an account's master copy side by side, and the
-- constraint that makes exactly one of them present was deliberately left out
-- until every writer had moved. They have, and `0017` has given the accounts
-- that needed them their rows, so an ambiguous row stops being expressible.
--
-- Ambiguous means either way. A row with both owners is a snapshot and a master
-- copy at once, and nothing can say which resume it belongs to. A row with
-- neither is unreachable: every read of a section starts from an owner, so it
-- is a row no query will ever return and no cascade will ever collect.
--
-- `<>` over `IS DISTINCT FROM` on purpose: `IS NULL` never yields null, so
-- plain inequality is exactly "one of them, not both, not neither", and the
-- constraint is never itself null — a check constraint that evaluates to null
-- passes, which is how this kind of rule is usually written wrong.
--
-- This is its own deploy, after the backfill's, because that is what
-- expand-and-contract buys: the previous version of the app keeps serving
-- against a database with this constraint in place, since it already writes one
-- owner and nulls the other. Nothing here rewrites a row, so the ACCESS
-- EXCLUSIVE lock is held only for the scan that validates the rows already
-- there — `section` is small, and the scan is what the preflight has just done
-- read-only anyway.
--
-- The preflight is that scan, run before the `ALTER` so a deploy that cannot
-- proceed says why. Postgres' own failure names the constraint and one example
-- row; this names the count and points at the backfill, which is the thing that
-- would have had to go wrong. Migrations run before the build (`vercel.json`),
-- so failing here fails the deploy rather than the app.
DO $$
DECLARE
  ambiguous bigint;
BEGIN
  SELECT count(*) INTO ambiguous
  FROM "apply-ai_section"
  WHERE ("resume_id" IS NULL) = ("user_id" IS NULL);

  IF ambiguous > 0 THEN
    RAISE EXCEPTION
      'section_one_owner: % section row(s) claim both a resume and an account, or neither', ambiguous;
  END IF;

  ALTER TABLE "apply-ai_section"
    ADD CONSTRAINT "section_one_owner"
    CHECK (("resume_id" IS NULL) <> ("user_id" IS NULL));
END $$;
