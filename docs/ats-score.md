# ATS score

Research for turning "here's your resume" into "here's your resume, and here's
what's wrong with it for _this_ job." **No scoring is built.** Several things it
depends on have landed since this was written — see
[where the codebase stands](#where-the-codebase-stands).

The short version: the feature is worth building, but the name is a lie and the
lie is load-bearing. There is no single number a real ATS emits that we could
reproduce. What we _can_ do — and what nobody in this market does honestly — is
score the two things that are actually mechanical (does the document parse, does
it cover the posting) with a rubric we publish, and keep the unfalsifiable parts
out of the number.

## What an ATS actually does

Worth pinning down before designing a score, because the market is built on a
vague claim and we'd be shipping into that.

**Parsing is real and it is brittle.** Greenhouse documents exactly what it
pulls out of an uploaded resume — skills, job titles, years of experience,
employment start/end dates, company names, and a derived industry
classification, and [explicitly nothing
else](https://support.greenhouse.io/hc/en-us/articles/41131616864283-Talent-Matching-Data-Processing-FAQ).
Its [parse-failure
page](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse)
is a list of the exact document sins that break it: multi-column layouts,
tables, graphics and photos, letter-spaced text, contact details stranded in
headers/footers/text boxes, missing section breaks, company names without an
`Inc.`/`LLC` suffix, and abbreviated job titles (`Sr. Account Exec` instead of
`Senior Account Executive`).

That last pair is the most useful thing in this whole document, because it is
_specific_, _checkable_, and _nobody's resume checker checks it_.

**Scoring is real in some systems and absent in others.** These are not the same
product and a single "ATS score" cannot describe both:

| System                                                                                                                 | Automated scoring?                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workday (via [HiredScore](https://www.workday.com/en-us/products/talent-management/ai-recruiting.html), acquired 2024) | Yes — candidates get an **A–D grade** against job requirements.                                                                                                                                                     |
| Greenhouse Talent Matching                                                                                             | Yes, but as five buckets — **Strong / Good / Partial / Limited Match** plus "needs manual review" — computed against _recruiter-defined calibration criteria_, with the recruiter making every advance/reject call. |
| Greenhouse core pipeline                                                                                               | No algorithmic scoring or auto-reject. Human scorecards against "Focus Attributes."                                                                                                                                 |

Greenhouse's matcher is worth studying because it's the only one that documents
its mechanism: a **series of task-specific fine-tuned LLMs** for extraction, then
**embeddings over skills and job titles** for semantic search, so "software
engineer" matches a search for "software developer." Then it shows the recruiter
highlighted resume terms, a match justification, matched skills, missing skills,
and extra skills the calibration didn't ask for.

That is a synonym-tolerant, evidence-showing matcher. Two consequences for us:

1. **Literal keyword stuffing is aimed at the wrong target.** A tool that tells
   users to repeat the exact string "cross-functional collaboration" four times
   is optimizing for a 2010 ATS.
2. **The output shape to copy is Greenhouse's, not Jobscan's.** Matched /
   missing / extra, with the evidence attached. The bucket is a summary of the
   list; the list is the product.

**The filtering is real, and it's mostly crude and human-configured.** The
Harvard Business School / Accenture ["Hidden
Workers"](https://www.hbs.edu/ris/Publication%20Files/hiddenworkers09032021_Fuller_white_paper_33a2047f-41dd-47b1-9a8d-bd08cf3bfa94.pdf)
study found **88% of employers say their own ATS screens out qualified
candidates**, and that **49% knock out anyone with a 6+ month employment gap**.
Those are configured knockout rules — degree required, gap length, years in
title — not a similarity score. A resume can be a perfect semantic match and
still die on one of them.

## What the competition ships

| Tool                                                                             | What it claims                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Jobscan](https://www.jobscan.co/blog/what-jobscan-match-rate-should-i-aim-for/) | 1–100% "match rate" over hard skills, soft skills, buzzwords, titles; "based on five priorities" that are never enumerated. Recommends aiming for 75–80% and warns above that you sound "keyword-stuffed and robotic." |
| Teal                                                                             | "15 checks" — structure, clarity, measurable results, keywords.                                                                                                                                                        |
| Resume Worded                                                                    | "30+ checks" — weak verbs, vague accomplishments, missing metrics.                                                                                                                                                     |

**None of them publish a rubric.** Jobscan's own advice is the tell: a score
whose vendor tells you not to maximize it is not a score, it's a nudge with a
percent sign on it. And a score that moves for reasons the user can't see is a
support burden — every "why did it drop 6 points?" is a ticket.

So the differentiator is available and it's cheap: **publish the rubric, show
the arithmetic, and make every deduction come with the fix**. That's a product
decision, not an ML problem.

## The recommended shape

**Four axes, scored and displayed separately. No single headline number.**

The urge to average them into one gauge should be resisted, because they are not
commensurable and they don't fail together. Parseability is a bug — it's binary,
it's our fault, and it should be at zero. Coverage is a genuine gradient.
Averaging them lets a beautifully-parsing resume that matches nothing show 70%.

### 1. Parseability — deterministic, and mostly our own bug

Checked against the extracted text layer of **our own generated PDF**, not
against the React tree. The print gives us a text layer we can read back, so
this is a real assertion about the artifact, not a proxy for it.

This axis has a strange property that is a huge advantage: **we control the
template, so we can make it structurally perfect and keep it there.** Against
Greenhouse's failure list the document passes on layout — single column, real
`<ul>/<li>` for bullets, no tables, no text as an image — and that is no longer
a claim from reading the source. It is asserted per style in
`resume-sections.test.ts`, because a new style is exactly the kind of change
that would quietly reintroduce a sidebar or a layout table.

Two of the three defects this section originally listed have been fixed:

- ~~**`ContactLine` hides the URL.**~~ Contact details render the address as the
  visible text, not the word "LinkedIn" over an `href`. A test at seam 3 asserts
  the URL is in the text layer, because that is the half a parser can read.
- ~~**Overflow silently deletes content.**~~ The fixed page height and
  `overflow-hidden` are gone — see
  [page overflow](./editable-resume.md#page-overflow). It mattered here too:
  clipped text is missing from the PDF text layer, so it was an invisible parse
  failure, and a score would have confidently reported on a document whose
  bottom third did not exist.

One remains, and it is still the most valuable thing on this list:

- **Abbreviations and bare company names** are user-entered and unchecked. This
  is the check nobody else runs and Greenhouse explicitly asks for: flag
  `Sr.`/`Mgr`/`Eng` in a title, flag a company name with no legal suffix.

The rest is verification: every profile field appears in the text layer, section
headings are the conventional words (`Experience`, `Education`, `Skills`), dates
parse to a real range, and end-date ordering is sane.

### 2. Coverage — the real work

Extract requirements from the job description, then look for evidence of each
one in the resume. Three sub-scores, because the requirement types don't behave
alike:

- **Hard requirements** — named tools, languages, certifications, degrees.
  Present or absent; a synonym counts, a near-miss doesn't.
- **Responsibilities** — the "you will…" clauses. Matched semantically against
  bullets, not against a keyword list.
- **Knockouts** — years of experience, degree, seniority, location/on-site,
  clearance. Not scored. **Surfaced separately as pass/fail**, because per the
  HBS data these decide the outcome before any similarity math runs, and
  averaging a hard fail into a percentage buries the one thing the user needed
  to see.

Weight each requirement by where it appeared in the posting — a "Requirements"
bullet outranks a "Nice to have" one — and say so in the UI.

### 3. Evidence quality — per-bullet, and _not_ in the coverage number

Metric present, strong opening verb, specific outcome, reasonable length. This
is the Resume Worded axis and it's worth having, but it is about the resume in
isolation. Keep it out of the match score so users can't fix a coverage gap by
polishing prose.

### 4. Honesty — the one nobody ships

Every claimed match should point at the bullet that supports it, and any
requirement the model wants to "cover" that has **no basis in the user's
profile** must be flagged as _not yours to claim_, never auto-inserted.

The generator used to be the risk here: it was told to produce keywords for a
recruiting algorithm with no instruction against inventing them, while the
import prompt already said "never invent employers, schools, dates, or
numbers." A score that rewards coverage, wired to a generator that will happily
manufacture coverage, is a machine for helping users lie in interviews.

**That half is done.** `generate-resume.ts` now requires every employer, school,
title, date, number and skill to appear in the user's history, and forbids
claiming a technology or result the history does not support. It cannot be unit
tested — asserting on prompt _strings_ would pass while the model fabricated
freely, which reads as coverage and is worse than no test — so it is checked by
hand against the real model with a written-down fixture set. See
[anti-fabrication-review](./anti-fabrication-review.md), and run it whenever the
prompt or the model behind it changes.

**The half that is not done** is the flag: a requirement the model wants to
"cover" that has no basis in the profile must be surfaced as _not yours to
claim_, never auto-inserted. Do not ship coverage-driven rewriting without it.

## Where the codebase stands

This was written as a list of blockers — the reasons this is a feature and not
an afternoon. Three of the four have since landed, and they are recorded here
rather than deleted because the build order below assumed them.

**Landed — the posting is persisted.** `resume.jobDescription` is written when
the resume is generated and shown in the resume list, so a resume can finally
say which job it was for. Nothing job-relative could be scored, re-scored or
displayed until it existed.

**Landed — a resume snapshots everything it renders.** `skill` and `contact` now
carry a nullable `resumeId` (#48), so a score computed over the skills section
no longer goes stale the moment the user edits their profile for a different
application. The hash-and-mark-stale workaround this section used to recommend
is not needed for _that_ reason — but it is still needed for editing, since
every autosaved keystroke invalidates a stored score. **Store the score with a
content hash of what it was computed over.**

**Landed — there is a test runner.** Vitest, and the two throwaway probes this
section pointed at are committed as
[verified](./editable-resume.md#verified). That mattered because a scoring
rubric is exactly the kind of code that rots silently: it keeps returning a
plausible number while meaning something different. Fixture-based tests over
`(resume, posting) → score` are the only way to change weights without guessing,
and there is now somewhere to put them.

**Still true — most of a parseability checker already exists.**
`extractPdfText` and `extractResumeFields`
(`src/server/modules/profile/parse-resume-pdf.ts`) read a PDF and pull typed
fields out of it with an LLM. Render our own PDF, read the text back, and diff
the round trip against the input. Reuse it rather than writing a second
extractor.

## Extraction: how to get requirements out of a posting

Three approaches, and the third is the one to build.

**Literal keyword frequency** (Jobscan's visible behavior) is cheap and wrong
for the target — it optimizes against systems that, per Greenhouse's own docs,
match on embeddings.

**Embeddings alone** are what the research favors — [ConFit
v2](https://arxiv.org/pdf/2502.12361) and
[Resume2Vec](https://www.mdpi.com/2079-9292/14/4/794) both beat BM25 baselines
on resume–job ranking, with Resume2Vec reporting up to ~16% nDCG improvement
over conventional ATS ranking. But those papers optimize _ranking a pool of
candidates for a recruiter_. We have one resume and one posting, and our user
needs a list of missing things to go fix. A cosine similarity of 0.78 is not
actionable.

**Structured LLM extraction, then embeddings for the match.** This mirrors what
Greenhouse actually does and it's the only one that produces a fixable list:

1. LLM extracts the posting into typed requirements — `{ text, kind:
hard|responsibility|knockout, weight: required|preferred }`. `temperature: 0`,
   `response_format: json_object`, Zod-validated — the exact pattern
   `extractResumeFields` already uses.
2. Same for the resume's evidence units (bullets, skills).
3. Match requirements to evidence by cosine similarity over embeddings
   (`text-embedding-3-small` is plenty), with a threshold, so synonyms count.
4. Score deterministically in TypeScript from the match table.

**Step 4 is the important one.** The arithmetic must live in plain, tested code,
not inside a prompt. If a model returns the score, the number is unstable across
runs, unexplainable, and untestable — and the whole differentiator was
publishing the rubric.

Worth evaluating but not for v1: normalizing extracted skills against a real
taxonomy. [Lightcast Open Skills](https://lightcast.io/open-skills) is ~34,000
skills with a free API and refreshes fortnightly; [ESCO](https://esco.ec.europa.eu/)
is the richest labeled alternative. Both would let "React.js", "ReactJS" and
"React" collapse to one id and give us a stable vocabulary to cache and report
on. Embeddings get most of that benefit with far less integration, so this is a
v2 lever.

## Cost, latency, caching

Per scored pair: one extraction call on the posting (~2–4k tokens in), one on
the resume, and a batch of embeddings. Sub-second work at the margin, but not
free per keystroke — the resume editor autosaves on every blur.

- **Key the posting extraction by a hash of the posting text.** Postings are
  pasted repeatedly and are the larger input.
- **Never score on keystroke.** Debounce, or make scoring explicit — a
  "re-check" affordance is also the honest UI, since it stops the number
  flickering while the user is mid-sentence.
- **Store the score plus the content hash it was computed over.** Stale is a
  state to display, not a thing to hide behind a silent refetch.

## Build order

Each step ships something.

**Already done**, and they were the first three steps of this list: the posting
is persisted, the template's two parse defects are fixed, and there is a test
runner. The generator's anti-fabrication rule shipped early, out of order,
because it is the one defect here that can cause a user real harm.

What is left:

1. **The remaining parse defect** — flag abbreviated titles and bare company
   names. Do this _before_ scoring parseability, so the score is not reporting a
   clean document that a real parser will read as `Sr. Acct Exec` at a company
   with no legal suffix.
2. **Parseability score.** Fully deterministic, no model, no posting needed.
   Reads back our own PDF's text layer via the existing `pdf-parse` path. Ships
   as a standalone "your resume will parse cleanly ✓" and is the cheapest
   credible thing on the list.
3. **Requirement extraction + coverage.** The matched / missing / extra list
   first, with evidence links. The number comes last and is derived from the
   list — not the reverse.
4. **Knockouts as a separate pass/fail panel.**
5. **The "not yours to claim" flag** on any suggested requirement with no basis
   in the profile. Do not ship coverage-driven rewriting without it.
6. **Evidence quality**, per bullet, displayed separately.

Steps 1–2 are the defensible core and involve no scoring model at all. Steps
3–6 are where the product is.

## Open questions

- **Do we show a number at all, or four?** Four is honest; one is what users
  expect and screenshot. Leaning: four axes, each with a plain-language state
  (`will parse cleanly` / `2 required skills missing`) rather than percentages,
  and no aggregate.
- **What do we claim in copy?** Not "your ATS score." Something we can defend:
  "how this reads to a parser, and how it covers this posting." The market's
  vagueness is an opening, not a template.
- **Does the score gate anything?** It shouldn't. A user who knows they lack a
  requirement and applies anyway is making a reasonable call, and per the HBS
  data the filters they're up against are often wrong about them.
- **Per-posting resumes.** Once postings are stored, "score" and "tailor" are
  the same data model, and the coverage list is already a rewrite plan. That's
  the actual game-changer; the score is how the user learns to trust it.

## Sources

- Greenhouse — [Talent Matching Data Processing FAQ](https://support.greenhouse.io/hc/en-us/articles/41131616864283-Talent-Matching-Data-Processing-FAQ) (extracted fields, fine-tuned extraction models, embedding-based semantic match, five match buckets)
- Greenhouse — [Unsuccessful resume parse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) (the concrete parse-failure list)
- Workday — [HiredScore AI for Recruiting](https://www.workday.com/en-us/products/talent-management/ai-recruiting.html) (A–D candidate grading)
- Fuller & Raman et al., Harvard Business School / Accenture — [Hidden Workers: Untapped Talent](https://www.hbs.edu/ris/Publication%20Files/hiddenworkers09032021_Fuller_white_paper_33a2047f-41dd-47b1-9a8d-bd08cf3bfa94.pdf) (88% screen out qualified candidates; 49% knock out 6-month gaps)
- Jobscan — [What match rate should I aim for](https://www.jobscan.co/blog/what-jobscan-match-rate-should-i-aim-for/) (75–80% target, over-optimization warning)
- [ConFit v2](https://arxiv.org/pdf/2502.12361) and [Resume2Vec](https://www.mdpi.com/2079-9292/14/4/794) (embedding-based resume–job ranking vs BM25)
- [Lightcast Open Skills](https://lightcast.io/open-skills), [ESCO](https://esco.ec.europa.eu/) (skill taxonomies)
