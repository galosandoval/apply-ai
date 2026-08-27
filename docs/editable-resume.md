# Editable resume

Plan for turning the resume from a write-once PDF export into a document you can
click into and edit. All six steps are done — steps 5 and 6 landed with the
App Router modernization (issue #47), which also gave the repo a test runner.

## Why this refactor exists

There are two divergent resume templates today, and the one the PDF uses cannot
be edited:

- **`Resume`** (`src/components/resume.tsx:9`) renders an _empty skeleton_.
  Every element is `<p id="email">` with no children. It takes **counts**, not
  data: `skillsCount`, `educationCount`, `expDescCount`.
- **`src/pages/api/resume/pdf.ts`** launches Puppeteer, navigates to
  `/pdf?skillsCount=3&eduCount=2&desc0=4…`, and then fires ~40 `page.$$eval`
  calls that inject `innerHTML` into those ids.
- **`Resume2InChat`** (`src/components/resume.tsx:171`) is the actual
  data-driven template, with an `isEditing` / `startEditing` / `finishEditing`
  inline-edit pattern already sketched in.

So the PDF is produced by string-templating through the DOM against a template
that holds no data. Changing a piece of copy means touching form state, the
id-injection map, and the querystring encoder — three places that have to agree.
This isn't a PDF problem; it's that the PDF path shares no data model with the
editor.

## Decisions already made

| Question         | Decision                                                                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Edit interaction | ~~Inline field swap.~~ **Selection and panel** since spec D (#50): clicking the document selects something and a panel beside it edits that thing's fields. The document is a read-only live preview.                                                                                            |
| Persistence      | ~~Autosave on blur.~~ **Debounced autosave plus commit on blur** since spec D. A panel holds several inputs and has no natural "done" moment, so a pause is the commit and blur flushes what the pause has not sent. Save state — saving, saved, failed — is on screen.                          |
| Rich text        | ~~Plain text only.~~ **A constrained markdown subset** since spec D: bold, links and bullet lists, in a plain textarea with a toolbar. The stored value is exactly what was typed, so `stripMarkdown` gives a parser clean text with no sanitizer in the way. See `src/lib/resume-markdown.tsx`. |
| PDF engine       | **Puppeteer + `page.setContent`**, rendering the same React component. `@react-pdf/renderer` has already been dropped from `package.json` — do not reintroduce it; it needs a second template tree and can't use Tailwind.                                                                       |

## Step 1 — Addressable data model (done)

`work.description` (a single text column, split on `". "` at render time) became
`work.bullets` (`text[] NOT NULL`). Bullet 3 of job 2 is now a real addressable
thing rather than a substring boundary.

- `migrations/0001_dazzling_fallen_one.sql` — add nullable, backfill by
  splitting on `'. '`, then `SET NOT NULL`
- `migrations/0002_petite_vapor.sql` — drop `description`
- Onboarding's experience textarea became `BulletsField`: one line per bullet
- Onboarding forms now round-trip the row `id`, so `replaceEducation` /
  `replaceExperience` / `replaceSkills` stop minting a fresh `createId()` on
  every save. React keys use `id ?? index` instead of `job.name`.

> **Migrations apply on app boot.** `src/server/db/index.ts:12` calls
> `migrate()` at module top level, so simply starting the app runs 0001 and
> 0002 and drops the `description` column.

## Step 2 — One data-driven template (done)

The two templates collapsed into a single pure component:

```tsx
<ResumeDocument data={resume} />
```

Props in, markup out. No `watch`, no `register`, no ids-for-injection.

- `Resume2InChat` became `ResumeDocument`, taking a `ResumeDocumentData` prop —
  the contract the editor, chat preview and PDF all assemble. `phone` /
  `linkedIn` / `portfolio` are optional so `DownloadPdfSchema` satisfies it.
- The skeleton `Resume`, the commented-out `ResumeInChat`, and the dead
  first-generation subcomponents (`Header`, `Contact`, `Skills`, `Education`,
  `Interests`, `Profile`, `Experience`, `Job`) are gone. `resume.tsx` went from
  1233 lines to 195.
- `src/pages/pdf/index.tsx` deleted.
- `EditableFields` and `initialEditingState` (`src/pages/dashboard/index.tsx`)
  went with it — step 3 replaces them rather than generalizing them.

> **Knowingly broken until step 5:** the PDF endpoint still does
> `page.goto("/pdf?…")` against a route that no longer exists, so download 404s.
> (Editing came back in step 3.)

## Step 3 — `<Editable path=… />` (done)

Every editable string now has a stable address:

```tsx
<Editable path="experience.0.bullets.2" as="li" multiline />
```

`path` is simultaneously the click target's identity, the key an edit writes to,
and the scope for a future "rewrite this section for this job posting" AI call.

**`path` is typed, not `string`.** `ResumeFieldPath` is react-hook-form's
`FieldPath<InsertResumeSchema>` **filtered to paths whose value is a string**.
Bare `FieldPath` also admits `experience.0` and `experience.0.bullets`, which
would render as an empty click target and let `setValue` write a string over an
array; the filter rejects those at compile time along with typos. It also means
`setValue(path, value)` typechecks with no cast.

**Behavior:** plain text until clicked, then an input in the same box; commit on
blur or Enter, cancel on Escape. `multiline` gives a textarea where Shift+Enter
is a newline and plain Enter still commits — and multiline display carries
`whitespace-pre-line` so those newlines survive the round trip.

An empty value renders as a grey em-dash placeholder wherever the field is
_editable_ — a blank bullet would otherwise collapse to a zero-height element
with nothing to click. Read-only renders show nothing, since a placeholder in a
finished document (or the PDF) would be worse than a gap.

**The value is read from `path`, not passed in.** `ResumeDocument` puts `data`
on a context and `Editable` walks the path to find its own text, so the text on
screen and the field an edit writes to cannot drift apart.

**Read-only is the absence of `onEdit`.** `<ResumeDocument data={…} />` with no
handler renders plain tags — which is exactly what the step 5 PDF render wants.

**Two places the editor and the document deliberately diverge**, both keyed off
`onEdit`:

- Contact details render as `<a>` links in the document (so they stay clickable
  in the PDF) but as plain `Editable` text in the editor — a link that opens on
  click can't also be a click-to-edit target.
- A blank contact is dropped from the document but kept as an empty placeholder
  in the editor, otherwise there'd be no way to ever fill it in.

**Not editable:** `fullName` (it comes from the profile, not the resume form) and
section titles. Adding or removing bullets/jobs/schools is still out of scope —
`Editable` edits existing strings only.

## Step 4 — Autosave (done)

`useEditableResume(resumeId)` in `src/pages/resume/[id].tsx` is the whole
persistence surface: it loads the resume, assembles the document data, and
returns an `onEdit` that autosaves through `resume.updateField({ path, value })`
with an optimistic cache update and rollback on error.

**The editor route now exists.** `src/pages/resume/[id].tsx` consumes the
`resume.readById` procedure that previously had no caller, and `appPath` gained
`resumeById(resumeId)`. The `/resume` list used to build that href by hand with a
`?name=` querystring the target never read; it now uses `appPath` and the editor
reads the name from the profile.

### Only the snapshot is editable

> **Superseded by spec B (#48).** What follows is why the editor was
> snapshot-only; the paragraph after it is what is true now.
>
> **Also superseded by spec D (#50):** contact and skills are not read-only
> anywhere. Everything the document draws is edited from the panel.

A saved resume snapshots its own `work` / `school` rows via `resumeId` — but
**`skill` and `contact` had no `resumeId`, and email lived on `user`.** Those
were shared by every resume the profile owned, so editing one from a resume
editor would silently rewrite the others.

So the editor was snapshot-only: `profession`, experience and education were
live; skills, contact details and name rendered read-only.

**Since #48 a resume owns all of it.** `skill` and `contact` both carry a
nullable `resumeId`: a row with it set is one resume's copy, a row with it null
is the account's master copy, which seeds a new resume and is never read at
render time. `contact` also carries `full_name` and `email`, so a saved resume
still says what it said when it was sent even after the account changes its
name. Everything the document draws is now editable, and editing the account
deliberately does not reach an existing resume — `resume.refreshFromAccount`
pulls current details in when that is actually wanted.

Both the click target (`canEditPath`) and the server write still derive from
**one** parser — `src/lib/resume-field-path.ts` — so the UI and the write can't
disagree about what's editable, and a hand-made request can't reach a column the
template wouldn't offer.

**Contact and skills got addresses of their own rather than the ones that were
closed.** `contact.email` and `skill.<row>.all` are editable; bare `email` and
`skills.0.all` are still rejected, unchanged, along with the other 19 shapes the
parser refused before. That is the proof the grammar was extended rather than
replaced, and it is why the document data nests contact under `contact` and
names the skill array `skill`.

### One parser, two path flavours

`src/lib/resume-field-path.ts` owns the grammar and the writable-column list.
It's imported by the template's `canEditPath`, the optimistic cache patch, and
the server mutation — previously each of those had its own copy of the rules, so
adding an editable field meant touching five places that had to agree.

The template speaks in indices (`experience.1.name`) because that's what
react-hook-form paths look like; the mutation speaks in row ids
(`experience.<cuid>.name`). Same grammar, so one parser handles both —
`withRow` swaps an index for an id, and an edit can't land on the wrong job if
rows come back in a different order.

`readById` also gained `ORDER BY id` — previously the row order was whatever
Postgres felt like, so indices meant something different on each fetch. `id` was
stable but arbitrary; **#48 added the `position` column** that was owed on `work`
and `school`, backfilled from that id order, and `resume.reorderRows` moves a
job, a school or a skill group within its section.

### Autosave details worth remembering

- **Rollback is per-field, not per-snapshot.** Reverting the whole cached resume
  would also undo edits that had already succeeded, so `onMutate` captures just
  the previous value of the field it's about to change.
- **`invalidate` waits for the last write in flight.** Tabbing quickly through
  fields fires overlapping mutations; refetching after the first would serve a
  response predating the others and clobber their optimistic values.
- Textareas size from content via `scrollHeight`, not from newline count — a long
  bullet wraps to several lines without containing a newline at all.

### Verified

Both probes are committed now, as `src/server/api/routers/resume.test.ts` and
`src/lib/resume-field-path.test.ts`. The committed suites are supersets of the
counts below — the router file adds an unauthenticated caller and a
row-untouched-after-rejection check, and the parser file one more rejected
shape — so treat the numbers here as the origin, not the current total.

- **Server, 17 checks** against the live database through the real router,
  including `assertOwnsResume`: writes land on the right column and replace
  exactly one bullet; and `email`, `skills.0.all`, `profileId`, `resumeId`, the
  bare `bullets` array, an out-of-range index, a non-numeric index, a
  trailing-dot index (which `Number()` coerces to 0), an unknown section, a row
  belonging to another resume, and another user's resume are all rejected.
- **Parser, 32 checks**: every accepted path shape, 21 rejected ones, and the
  index→id→reparse round trip.

### Still owed

- ~~**The dashboard chat preview still can't persist.**~~ Resolved by deletion
  in spec D (#50): generation now creates the resume and redirects to the
  editor, so there is one editing surface instead of one and a half. The
  posting is written with the resume, and `resume.remove` deletes a draft the
  user dislikes.
- ~~**Deleting a resume would strand its snapshot.**~~ `resume.remove` (spec D)
  deletes `work`, `school`, `skill` and `contact` rows scoped to the resume in
  one transaction before the resume itself. `section.resume_id` still cascades;
  the others cannot, because a nullable `resumeId` is also how a master copy is
  spelled.
- ~~**Sections exist but are not drawn from.**~~ Done in spec C (#49):
  `ResumeDocument` draws `data.sections` in `position` order through five base
  components, and the bespoke Skills / Experience / Education renderers are
  gone. Core sections are pre-configured instances of those components fed by
  their typed rows; a custom section is a user-created instance fed by its own
  content. Editing a custom section's content is still spec D — this spec
  renders it read-only.
- ~~`Editable` keys bullets by array index~~ — `Editable` is gone. The panel
  keys every input by its field path, which is keyed by row id, so reordering
  cannot carry an edit to the row that took a position.
- ~~No add/remove for bullets, jobs or schools.~~ Spec D adds
  `resume.setBullets` (a job's whole bullet list, so add, remove and reorder are
  one write), `resume.addRow` / `resume.removeRow` for jobs, schools and skill
  groups, and `section.setContent` for a custom section's elements.
  `updateField` still replaces existing strings only, which is the split: one
  write edits a string, another changes the set of them.

## Step 5 — PDF via `setContent` (done)

`page.goto(url)` + `$$eval` became a direct render, with Playwright's Chromium
in place of Puppeteer (`src/server/modules/profile/render-resume-pdf.ts`):

```ts
const html = renderToStaticMarkup(<ResumeDocument data={input} />)
await page.setContent(shell(html, tailwindCss), { waitUntil: "load" })
const pdf = await page.pdf({ format: "A4", printBackground: true })
```

**Deleted:** `createEndpoint` and `insertValuesOnPage` in
`src/pages/api/resume/pdf.ts` (~200 lines), the whole querystring protocol, and
the `/pdf` route. The route is now `src/app/api/resume/pdf/route.ts`.

The markup comes from `renderResumeHtml` — one function over the same component
the editor renders. Making that possible split the template in two: the pure,
hook-free `resume-document.tsx`, and `resume.tsx`, which supplies the stateful
click-to-edit field renderer. A component that calls `useState` cannot be
rendered from a route handler, and the PDF is rendered from a route handler.

**Wins beyond the line count:** no network round-trip, so it's faster; and
Puppeteer no longer needs a session, which is otherwise a wall the moment the
PDF needs authenticated data.

**The one new problem:** the shell needs the compiled Tailwind CSS inlined. It
is read off `.next/static` at request time rather than hand-maintained.

## Step 6 — Page overflow (done)

`ResumeDocument` hardcoded `h-[29.7cm]` with `overflow-hidden`, so content past
one page was **silently clipped** — no scrollbar, no warning, the text simply
was not in the document.

- The fixed height and `overflow-hidden` are gone; the page is normal flow.
- ~~Each job and school carries `break-inside-avoid`, so neither splits across
  a page boundary.~~ Step 8 takes that off the entry: keeping a job whole is
  what throws a nine-bullet role onto the next sheet and wastes most of the one
  before it.
- ~~**Still owed:** a visible page-boundary rule in the editor.~~ Spec D draws
  it: the editor overlays a rule at each A4 page boundary, so spilling onto a
  second page is something the user sees before sending rather than after.

## Step 7 — Selection and panel (spec D, #50)

Inline editing is gone. `Editable`, `PlainField`, `resume.tsx`, the `onEdit`
prop threaded through the template, the `canEditPath` click gate and the
`ResumeFieldPath` template-literal type all went with it. `ResumeDocument` is a
read-only render that takes an optional `selection` prop; without it — the PDF,
the parseability check — it emits no click target, no outline and no attributes,
and a test at seam 3 asserts exactly that.

What replaced them:

- `src/lib/resume-selection.ts` — what can be selected (`header`, a section, or
  one row of a core section), keyed by row id, and the class and attributes that
  make an element selectable.
- `src/features/resume/use-resume-editor.ts` — the query, the debounced field
  autosave with per-field rollback, and every structural mutation.
- `src/features/resume/resume-panel-model.ts` — pure: a resume, a selection and
  the operations available in, a description of a panel out.
- `src/features/resume/resume-field-lens.ts` — pure: how one addressed field is
  read out of a cached resume and written back, for the optimistic update and
  its rollback. Moved out of the editor route unchanged.
- `src/features/resume/resume-panel.tsx` — renders a `PanelModel` and nothing
  else, so a sixth section shape is a registry entry rather than a sixth panel.
- `src/lib/resume-markdown.tsx` — the markdown subset: render, strip, and the
  three toolbar operations, all pure and all tested at seam 1.

The shape registry in `src/lib/section-content.ts` gained the panel's half of
each component type: `read`, `fields` and a `collection` describing how its
elements are added, removed and moved. That is what makes the panel generated
rather than written.

Six details worth keeping:

- **The refetch waits for pending keystrokes, not only sent writes.** A write
  still waiting out its debounce counts as outstanding; otherwise typing,
  waiting for that save, and typing again during the refetch it triggered loses
  the second keystroke.
- **Structural writes patch the cache too**, except adding — a new row's id is
  the server's to mint, and a locally invented one is a row the panel could
  select and then lose.
- **Selection clears** by clicking past the document or through the panel's
  back control. Without it the resume-level panel — the only place a section is
  added — would be unreachable after the first click.
- **A refused write rolls back the document, not the input.** The document is
  the preview and has to show what is stored, but the sentence the user typed
  stays in the panel until it saves or is typed over — a network error must not
  eat it. That text is remembered by path, so a success elsewhere cannot report
  the resume as saved while it is still only on screen, and leaving the page
  while any of it is outstanding warns first.
- **A structural write supersedes the pending writes inside what it rewrites.**
  `setBullets` and `setContent` carry every keystroke already, because the cache
  they are built from is patched as the user types; sending the debounced field
  write too would land it _after_ the reorder, at an index that by then names a
  different bullet. Removing a row drops writes to it for the same reason. Every
  other structural write flushes first instead.
- **Both exits flush.** Unmount and `beforeunload` send what is pending rather
  than only cancelling its timer: a debounce that throws away its last keystroke
  on the way out is a debounce that eats sentences.

## Step 8 — The document is a block list (#62)

The document is still a nested tree while it is being _built_ — a section owns
its entries, an entry owns its bullets — but what a page is filled with is a
**list**. `src/lib/resume-blocks.ts` names the unit: a block is the smallest run
of the document that is never cut, assigned whole to exactly one page or not at
all.

Nine kinds, and the set is closed on purpose — it is the list of places a page
break is allowed to fall: the contact header, a section heading and its rule, an
entry's identity line, one bullet, one education description, one rich-text
paragraph, one list group, a tag row, an icon row.

Three things follow, and each of them is a thing that used to live one level up:

- **`break-inside-avoid` moved off the entry and onto the block.** Asking the
  browser to keep a job whole is asking it to move the job whole. The block is
  deliberately smaller than an entry, so a job may split between two of its own
  bullets — the case entry-level unbreakability made impossible.
- **Spacing moved off the parent and onto the block.** `space-y-*` between
  entries, padding on the `<section>` element: a parent cannot space two
  children that have ended up on different sheets, and there is no element left
  that contains a whole section. Each block owns the gap _after_ itself, so a
  block arriving at the top of a page brings no gap with it.
- **Selection moved up to a run of blocks.** The handle is carried by the
  block rather than drawn inside it, and the renderer wraps each _run_ of
  adjacent blocks that select the same thing in one click target. An outline
  per block is five stacked boxes where the user selected one job. A run is
  computed rather than nested, so it can later be one page's worth of a job
  that spans two — which no wrapper element could have been. The gap after a
  run is margin, not padding: an outline is drawn outside the padding and
  inside the margin, and the box has to end where the content does.
- **A block that selects nothing of its own is selected by its section.** A
  shape addressed a row at a time — a job, a school, a skills group — answers
  for its own blocks, and the innermost target still wins. Everything else is
  the section, because a rich-text paragraph and a tag row are edited _through_
  the section panel: a box around the heading alone stopped at the rule while
  the panel edited the text under it, and clicking that text fell through to
  the page and cleared the selection.
- **A bullet is its own list.** One `<ul>` per bullet rather than one holding
  the job's nine, because an element cannot be in two places and a job split
  across a boundary asks exactly that of it. Every bullet is still a real list
  item inside a real list, on whichever sheet it lands on, and the discs line up
  because the indent is a token rather than a position.

Every block carries a stable key — `sectionId:position`, position _within its
section_ — its section id and its kind. Derived rather than generated, so a
height measured from the DOM can be matched back to the block it came from after
a re-render, and editing one section renumbers nothing in any other. The key and
the kind are emitted into the markup (`data-resume-block`,
`data-resume-block-kind`) because measurement happens over the rendered
document: in the editor's DOM, and in the browser the PDF is printed from.

The rendered output is unchanged — the same continuous flow, in the same order,
drawn the same way. This step changes what the document _is_, not what it looks
like; grouping the list into pages is the step after it, and `paginate` in
`src/lib/paginate.ts` is already waiting for the measurements.
