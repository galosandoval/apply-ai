-- Every existing account gets the sections its profile already holds.
--
-- Data only: #92 gave `section` an account owner and nothing wrote it, so no
-- account has sections and every reader falls back to the hardcoded defaults.
-- This is what turns that fallback into rows, so the account becomes the master
-- copy of its sections the way it already is of its contact details, jobs,
-- schools and skills — and so a new resume can be seeded from it (#97).
--
-- A section per thing the profile actually holds: an account with no schools
-- gets no Education section, and an empty profile gets nothing at all. The
-- fallback stays in place for exactly that account, so nothing is stranded
-- mid-deploy.
--
-- The order is `coreSectionDefaults`' — Skills, Experience, Education — because
-- that is the order a resume is drawn in, and the account's order is the order
-- new resumes will start in. `position` is dense from 0 over the kinds the
-- account actually got, so a profile with no jobs has no gap where Experience
-- would have been.
--
-- Core kinds carry no content here, as they do on a resume: `content` stays
-- null and the section points at the typed rows keyed by `user_id`. Skills is
-- the same on the account — the `skill` rows are the master copy, and it is
-- only on a resume that they are snapshotted into `content`.
--
-- The heading is written in the account's language, from the same strings
-- `sectionLabels` carries in the message files. English would otherwise become
-- the heading a Spanish account's next resume is drawn with — a regression
-- against what `sectionLabelerFor` writes today.
--
-- Idempotent: an account that already has sections of its own is skipped
-- entirely, so re-running cannot duplicate a row — and cannot resurrect one the
-- user has since removed, which is the case a plain `ON CONFLICT DO NOTHING`
-- would get wrong. The id is a digest of the account and the kind rather than a
-- cuid2, as `0006`'s were, because SQL has no cuid2 and a backfilled row is worth
-- recognising later; `rowId` validates an opaque string for exactly this.
INSERT INTO "apply-ai_section" ("id", "user_id", "kind", "label", "component_type", "position")
SELECT
  md5(u."id" || core.kind),
  u."id",
  core.kind,
  CASE WHEN u."locale" = 'es' THEN core.label_es ELSE core.label_en END,
  core.component_type,
  row_number() OVER (PARTITION BY u."id" ORDER BY core.rank) - 1
FROM "apply-ai_user" u
CROSS JOIN (VALUES
  ('skills',     'Skills',     'Habilidades',         'groupedList', 0),
  ('experience', 'Experience', 'Experiencia',         'twoColumn',   1),
  ('education',  'Education',  'Formación académica', 'twoColumn',   2)
) AS core(kind, label_en, label_es, component_type, rank)
WHERE NOT EXISTS (
  SELECT 1 FROM "apply-ai_section" s WHERE s."user_id" = u."id"
)
AND CASE core.kind
  WHEN 'skills' THEN EXISTS (
    SELECT 1 FROM "apply-ai_skill" k WHERE k."user_id" = u."id"
  )
  WHEN 'experience' THEN EXISTS (
    SELECT 1 FROM "apply-ai_work" w
    WHERE w."user_id" = u."id" AND w."resume_id" IS NULL
  )
  WHEN 'education' THEN EXISTS (
    SELECT 1 FROM "apply-ai_school" sc
    WHERE sc."user_id" = u."id" AND sc."resume_id" IS NULL
  )
END;
