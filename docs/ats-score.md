# ATS score

Research for turning "here's your resume" into "here's your resume, and here's
what's wrong with it for *this* job." Nothing here is built yet.

The short version: the feature is worth building, but the name is a lie and the
lie is load-bearing. There is no single number a real ATS emits that we could
reproduce. What we *can* do — and what nobody in this market does honestly — is
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
*specific*, *checkable*, and *nobody's resume checker checks it*.

**Scoring is real in some systems and absent in others.** These are not the same
product and a single "ATS score" cannot describe both:

| System | Automated scoring? |
| --- | --- |
| Workday (via [HiredScore](https://www.workday.com/en-us/products/talent-management/ai-recruiting.html), acquired 2024) | Yes — candidates get an **A–D grade** against job requirements. |
| Greenhouse Talent Matching | Yes, but as five buckets — **Strong / Good / Partial / Limited Match** plus "needs manual review" — computed against *recruiter-defined calibration criteria*, with the recruiter making every advance/reject call. |
| Greenhouse core pipeline | No algorithmic scoring or auto-reject. Human scorecards against "Focus Attributes." |

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

| Tool | What it claims |
| --- | --- |
| [Jobscan](https://www.jobscan.co/blog/what-jobscan-match-rate-should-i-aim-for/) | 1–100% "match rate" over hard skills, soft skills, buzzwords, titles; "based on five priorities" that are never enumerated. Recommends aiming for 75–80% and warns above that you sound "keyword-stuffed and robotic." |
| Teal | "15 checks" — structure, clarity, measurable results, keywords. |
| Resume Worded | "30+ checks" — weak verbs, vague accomplishments, missing metrics. |

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
against the React tree. Puppeteer gives us a text layer we can read back, so
this is a real assertion about the artifact, not a proxy for it.

This axis has a strange property that is a huge advantage: **we control the
template, so we can make it structurally perfect and keep it there.** Reading
`src/components/resume.tsx`, the template is already single-column, uses real
`<ul>/<li>` for bullets, and has no tables or images. Against Greenhouse's
failure list it passes on layout. Three concrete defects remain:

- **`ContactLine` hides the URL.** LinkedIn, GitHub and portfolio render as the
  *label* `LinkedIn` with the URL only in `href`
  (`src/components/resume.tsx:412`). A PDF text-layer parser sees the word
  "LinkedIn" and no profile. Fix: render the URL as the visible text.
- **Overflow silently deletes content.** `h-[29.7cm]` + `overflow-hidden` +
  `my-auto` (`src/components/resume.tsx:85`) clips anything past one page, with
  no scrollbar and no warning. Already logged as step 6 of
  [editable-resume](./editable-resume.md), but it belongs here too: clipped text
  is missing from the PDF text layer, so it's an invisible parse failure. **This
  should be fixed before shipping a parseability score**, or the score will
  confidently report on a document whose bottom third doesn't exist.
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

### 3. Evidence quality — per-bullet, and *not* in the coverage number

Metric present, strong opening verb, specific outcome, reasonable length. This
is the Resume Worded axis and it's worth having, but it is about the resume in
isolation. Keep it out of the match score so users can't fix a coverage gap by
polishing prose.

### 4. Honesty — the one nobody ships

Every claimed match should point at the bullet that supports it, and any
requirement the model wants to "cover" that has **no basis in the user's
profile** must be flagged as *not yours to claim*, never auto-inserted.

This is a real risk in the current flow. The generator prompt already tells the
model to "use the job description provided to respond with keywords for a
recruiter or recruiting algorithm" (`src/pages/api/resume/chat.ts:57`) with no
instruction against inventing them — unlike the import prompt, which does say
"Never invent employers, schools, dates, or numbers"
(`src/server/modules/profile/resume-pdf.ts:134`). A score that rewards coverage,
wired to a generator that will happily manufacture coverage, is a machine for
helping users lie in interviews. **Give the generator the import prompt's
anti-fabrication rule as part of this work.**

## Blockers in the current codebase

These are the reason this is a feature and not an afternoon.

**1. The job description is thrown away.** It only ever exists as
`useChat` message state on the dashboard (`src/pages/dashboard/index.tsx:83`),
posted to the edge handler and dropped. The `resume` table has no column for it
(`src/server/db/schema.ts:110`). **Nothing job-relative can be scored, re-scored,
or shown on `/resume/[id]` until the posting is persisted alongside the resume.**
This is the first commit, and it's independently useful — the editor page can't
even tell you which job a saved resume was for.

**2. A resume's skills and contact aren't snapshotted.** `skill` and `contact`
hang off `profile`, not `resume`, and email lives on `user` — already documented
in [editable-resume](./editable-resume.md#only-the-snapshot-is-editable). So a
stored score computed over the skills section goes stale the moment the user
edits their profile for a different application, with nothing to detect it. Two
ways out: store a content hash of everything scored and mark the score stale on
mismatch (cheap, honest, ships now), or finish the snapshot work (correct, and a
migration). **Recommend the hash first** — it's needed anyway once resumes are
editable, since every autosaved keystroke invalidates the score.

**3. No test runner.** Both step-4 probes in
[editable-resume](./editable-resume.md#verified) were run and thrown away. A
scoring rubric is exactly the kind of code that rots silently — it keeps
returning a plausible number while meaning something different. Fixture-based
tests over `(resume, posting) → score` are the only way to change weights
without guessing. **Add a runner as part of this feature.**

**4. `pdf-parse` already reads PDFs, and we already extract structure with an
LLM.** `extractPdfText` + `extractResumeFields`
(`src/server/modules/profile/resume-pdf.ts`) is most of a parseability checker
already: render our PDF, read the text back, and diff the round trip against the
input. Reuse it rather than writing a second extractor.

## Extraction: how to get requirements out of a posting

Three approaches, and the third is the one to build.

**Literal keyword frequency** (Jobscan's visible behavior) is cheap and wrong
for the target — it optimizes against systems that, per Greenhouse's own docs,
match on embeddings.

**Embeddings alone** are what the research favors — [ConFit
v2](https://arxiv.org/pdf/2502.12361) and
[Resume2Vec](https://www.mdpi.com/2079-9292/14/4/794) both beat BM25 baselines
on resume–job ranking, with Resume2Vec reporting up to ~16% nDCG improvement
over conventional ATS ranking. But those papers optimize *ranking a pool of
candidates for a recruiter*. We have one resume and one posting, and our user
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

1. **Persist the job description.** Column on `resume`, plumbed through
   `resume.create`, shown on `/resume/[id]`. Unlocks everything else and fixes a
   standing gap.
2. **Fix the template's parse defects** — visible contact URLs, and page overflow
   (step 6 of [editable-resume](./editable-resume.md)). Do this *before* scoring
   parseability so the score isn't reporting on a truncated document.
3. **Add a test runner**, and port the two orphaned probes into it.
4. **Parseability score.** Fully deterministic, no model, no posting needed.
   Reads back our own PDF's text layer via the existing `pdf-parse` path. Ships
   as a standalone "your resume will parse cleanly ✓" and is the cheapest
   credible thing on the list.
5. **Requirement extraction + coverage.** The matched / missing / extra list
   first, with evidence links. The number comes last and is derived from the
   list — not the reverse.
6. **Knockouts as a separate pass/fail panel.**
7. **Anti-fabrication rule in the generator prompt**, plus the "not yours to
   claim" flag on any suggested requirement with no basis in the profile. Do not
   ship coverage-driven rewriting without this.
8. **Evidence quality**, per bullet, displayed separately.

Steps 1–4 are the defensible core and involve no scoring model at all. Steps
5–8 are where the product is.

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
