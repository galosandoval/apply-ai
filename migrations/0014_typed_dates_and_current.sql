-- Dates become typed, and "still here" becomes a flag.
--
-- `start_date` and `end_date` were `text` validated only as 3–50 characters, so
-- the columns legally hold `Present`, `2020-2022`, `Jan 2020`, `current`, `now`
-- and the empty string — every one of which is in production data. Nothing can
-- be sorted, counted as years of experience, or gap-checked against that. They
-- become the ISO subset (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`), still held as `text`
-- because a partial date is not a `date` and Postgres has no type for one, and
-- `Present` moves out of the column and into `current`. See #71.
ALTER TABLE "apply-ai_school" ALTER COLUMN "end_date" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "apply-ai_work" ALTER COLUMN "end_date" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "apply-ai_school" ADD COLUMN "current" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "apply-ai_work" ADD COLUMN "current" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- The best-effort parse, mirroring `normalizeResumeDate` in
-- `src/lib/resume-date.ts`: the same shapes, the same answers. Two copies
-- because one of them has to run inside Postgres and the other has to run on a
-- string a model just returned, and neither can call the other.
--
-- **A date it cannot read is left exactly as it was.** That is the deliberate
-- fallback the spec asked for: the value keeps rendering (the formatter prints
-- an unrecognised date verbatim) and the new validator asks the user to fix it
-- the next time they write that field. A migration that quietly blanks a date
-- on a resume someone has already sent is the worst outcome available here, and
-- returning the input unchanged is what rules it out.
--
-- Written as a function and dropped again at the end rather than inlined four
-- times: four copies of a month table is four places for the next reader to
-- find a typo in.
CREATE FUNCTION apply_ai_normalize_resume_date(raw text) RETURNS text AS $$
DECLARE
  value text := btrim(coalesce(raw, ''));
  parts text[];
  month int;
  year text;
BEGIN
  -- Already in the subset. Checked first so a stored `2017-09` is never
  -- re-derived, and so `2017` keeps its year precision rather than gaining a
  -- month nobody wrote.
  IF value ~ '^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$' THEN
    RETURN value;
  END IF;

  -- `Sept 2017`, `September 2017`, `septiembre 2017`, with or without the dot.
  parts := regexp_match(lower(value), '^([[:alpha:]]+)\.?\s+(\d{4})$');

  IF parts IS NOT NULL THEN
    month := CASE left(parts[1], 3)
      WHEN 'jan' THEN 1  WHEN 'ene' THEN 1
      WHEN 'feb' THEN 2
      WHEN 'mar' THEN 3
      WHEN 'apr' THEN 4  WHEN 'abr' THEN 4
      WHEN 'may' THEN 5
      WHEN 'jun' THEN 6
      WHEN 'jul' THEN 7
      WHEN 'aug' THEN 8  WHEN 'ago' THEN 8
      WHEN 'sep' THEN 9  WHEN 'set' THEN 9
      WHEN 'oct' THEN 10
      WHEN 'nov' THEN 11
      WHEN 'dec' THEN 12 WHEN 'dic' THEN 12
      ELSE NULL
    END;

    -- A three-letter prefix is enough to tell the months apart in both
    -- languages, but not enough to prove the word was a month: `summer 2017`
    -- has to come back unread rather than as a date.
    IF month IS NULL THEN RETURN value; END IF;

    RETURN parts[2] || '-' || to_char(month, 'FM00');
  END IF;

  -- `09/2017`, `9/2017`, `09-2017`, `2017/09`. Whichever side is four digits is
  -- the year: both orders are in the data and both mean the same thing.
  parts := regexp_match(value, '^(\d{1,4})\s*[/-]\s*(\d{1,4})$');

  IF parts IS NOT NULL THEN
    IF length(parts[1]) = 4 THEN
      year := parts[1];
      month := parts[2]::int;
    ELSE
      year := parts[2];
      month := parts[1]::int;
    END IF;

    IF length(year) = 4 AND month BETWEEN 1 AND 12 THEN
      RETURN year || '-' || to_char(month, 'FM00');
    END IF;
  END IF;

  RETURN value;
END;
$$ LANGUAGE plpgsql IMMUTABLE;--> statement-breakpoint

-- An end date that says the entry has not ended is the flag, not a date.
--
-- Only the words. An *empty* end date is deliberately not read as "still here":
-- it is equally the blank row the editor inserts and the school someone left
-- the field off, and writing `Actualidad` under a degree finished in 2020 is a
-- false claim printed on a document. Empty stays empty, and the new validator
-- asks the user which of the two it was.
UPDATE "apply-ai_work"
SET "current" = true, "end_date" = ''
WHERE lower(btrim("end_date")) IN ('present', 'current', 'now', 'actual', 'actualidad');--> statement-breakpoint

UPDATE "apply-ai_school"
SET "current" = true, "end_date" = ''
WHERE lower(btrim("end_date")) IN ('present', 'current', 'now', 'actual', 'actualidad');--> statement-breakpoint

UPDATE "apply-ai_work"
SET "start_date" = apply_ai_normalize_resume_date("start_date"),
    "end_date" = CASE WHEN "current" THEN '' ELSE apply_ai_normalize_resume_date("end_date") END;--> statement-breakpoint

UPDATE "apply-ai_school"
SET "start_date" = apply_ai_normalize_resume_date("start_date"),
    "end_date" = CASE WHEN "current" THEN '' ELSE apply_ai_normalize_resume_date("end_date") END;--> statement-breakpoint

DROP FUNCTION apply_ai_normalize_resume_date(text);
