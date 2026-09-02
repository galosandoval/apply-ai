-- The old bodies, migrated into `body`, and then dropped.
--
-- A bullet becomes a `- ` line, which is exactly what it renders as: the
-- markdown renderer draws every `- ` line as a real list item inside a real
-- list, so a migrated job looks the way it looked yesterday. Order is taken
-- from the array's own ordinality rather than left to the aggregate, and blank
-- elements are dropped — a `- ` with nothing after it is not a list item.
--
-- A bullet's own newlines are folded to spaces first. The old panel edited a
-- bullet in a textarea and drew it with `whitespace-pre-line`, so a bullet
-- holding a line break is real data; left alone, the second line would fall
-- outside the `- ` and migrate into a paragraph of its own, next to the list
-- rather than inside it. One list item is what it was, so one line is what it
-- becomes.
--
-- Nothing here is escaped, because the subset has no escape. Legacy text that
-- already looks like markdown is read as markdown: a bullet or a description
-- holding `**` or `[label](url)` gains the formatting it appears to ask for.
-- The alternative is a backslash rule in a subset documented as three rules,
-- reconciled forever against the toolbar, `stripMarkdown` and the JSON Resume
-- export — a large standing cost against a rare shape in a field that was a
-- plain-text one-liner. See `docs/editable-resume.md`, under "Rich text is a
-- constrained markdown subset".
--
-- A school's description keeps its words and its line breaks, and gains nothing
-- else. It was drawn with the newlines it was typed with; markdown joins two
-- adjacent lines into one paragraph, so a line break becomes a blank line —
-- which is what markdown spells "these are two blocks". Re-marking the lines as
-- bullets would be this migration inventing a list the user never wrote.
UPDATE "apply-ai_work" AS w
SET "body" = COALESCE(
  (
    SELECT string_agg(
             '- ' || regexp_replace(btrim(b.value), E'\\s*\r?\n\\s*', ' ', 'g'),
             E'\n' ORDER BY b.ordinality
           )
    FROM unnest(w."bullets") WITH ORDINALITY AS b(value, ordinality)
    WHERE btrim(b.value) <> ''
  ),
  ''
);--> statement-breakpoint

UPDATE "apply-ai_school"
SET "body" = regexp_replace(COALESCE("description", ''), E'\r?\n', E'\n\n', 'g');--> statement-breakpoint

ALTER TABLE "apply-ai_school" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "apply-ai_work" DROP COLUMN "bullets";
