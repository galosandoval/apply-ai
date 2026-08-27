# The editable resume

How the resume editor works, and the decisions inside it that the code cannot
say for itself.

The resume was once a write-once PDF export: a skeleton template of empty
`<p id="email">` elements, filled in by ~40 Puppeteer `$$eval` calls driven off
a querystring. It is now a document you click into. What follows is the shape
that replaced it — see [How it got here](#how-it-got-here) for the path, which
is worth reading before changing anything that looks arbitrary.

The document's _appearance_ — the type scale, the three styles, what a style is
allowed to change — lives in [resume-style](./resume-style.md), not here.

## The shape of it

Editing is **selection and panel**: the document is a read-only live preview,
clicking it selects something, and a panel beside it edits that thing's fields.
Nothing is typed into the document itself.

| Module                                      | Owns                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `src/components/resume-document.tsx`        | The one template. Props in, markup out; builds the block list.           |
| `src/components/resume-section.tsx`         | The seven shapes a section can draw as, and the blocks each contributes. |
| `src/lib/resume-blocks.ts`                  | What a block is: its kinds, its key, the space it owns.                  |
| `src/lib/resume-selection.ts`               | What can be selected, and what makes an element selectable.              |
| `src/lib/section-content.ts`                | What a section is and may hold — shared by client and server.            |
| `src/lib/resume-field-path.ts`              | The grammar for addressing one editable string.                          |
| `src/lib/resume-markdown.tsx`               | The markdown subset: render, strip, and the three toolbar operations.    |
| `src/lib/paginate.ts`                       | Where the page breaks go, as a pure function.                            |
| `src/features/resume/use-resume-editor.ts`  | The query, the debounced autosave, and every structural mutation.        |
| `src/features/resume/resume-panel-model.ts` | Pure: a resume and a selection in, a description of a panel out.         |
| `src/features/resume/resume-field-lens.ts`  | Pure: how one addressed field is read out of the cache and written back. |
| `src/features/resume/resume-panel.tsx`      | Renders a `PanelModel` and nothing else.                                 |

## The document

`<ResumeDocument data={…} />` is the whole template — props in, markup out, no
form state and no ids for a browser to inject into. The editor renders it, the
PDF renders it, and the parseability check will render it, so what a user sees,
what gets printed and what a parser reads cannot drift apart.

It is **read-only always**. Three optional props are the only variation:

- `selection` adds click targets and an outline. Without it — the PDF, the
  parseability check — the render emits no click target, no outline and no
  attributes at all, and a test at seam 3 asserts exactly that. A selection
  outline in a finished PDF is not a cosmetic bug; it is the document saying
  something it does not mean.
- `mode` picks the A4 page or the phone's reflow over the same data.
- `isEditor` makes an empty section and an empty field a visible placeholder
  rather than nothing. A blank the user cannot see is a blank they cannot fill
  in; a placeholder in a finished PDF is worse than a gap.

A section is a **configuration of one of seven shapes** — rich text,
two-column, list, grouped list, tag list, icon list, meter — never a renderer of
its own. A custom section is a user-created instance; a core section
(Experience, Education) is a pre-configured one fed by its typed rows, which is
what keeps it machine-readable for the scoring work. That is also what gives a
style one surface to land on instead of one per section.

### Sections are picked by name, not by shape (#63)

A user adding "Certificates" is naming the content they have, not choosing
between a two-column frame and a tag row. So `src/lib/section-catalog.ts` offers
named sections — Text, Summary, Projects, Awards, Publications, Hobbies, Social
media, References and the rest — and the shape comes with the one they pick. The
label is an ordinary field afterwards, so a preset is a starting point rather
than a decision the user is stuck with. The shape still fixes at creation:
it decides what the content _is_, and there is no honest conversion from a
paragraph to a set of tags.

The catalog is client-side data. The server takes a label and a shape and
validates both, and has no opinion about which pairs a picker offers — a catalog
it enforced would be a second, weaker copy of the shape registry.

**Skills is no longer a core section.** Its categories were never the
machine-readable claim a date range or an employer is; they are a way of
arranging short strings, which is what `groupedList` is for. So a resume's
skills are that section's own `content`, the account keeps the only `skill`
rows, and Skills is in the catalog like everything else. It keeps `kind:
"skills"` for one reason: a refresh from the account has to know which section
the skills go back into, and a label the user is free to rename cannot answer
that. See `migrations/0010_skills_section_content.sql`.

### The document is a block list (#62)

The document is still a nested tree while it is being _built_ — a section owns
its entries, an entry owns its bullets — but what a page is filled with is a
**list**. A block is the smallest run of the document that is never cut:
assigned whole to exactly one page, or not at all.

Nine kinds, and the set is closed on purpose, because it is the list of places
a page break is allowed to fall: the contact header, a section heading and its
rule, an entry's identity line, one bullet, one education description, one
rich-text paragraph, one list group, a tag row, an icon row.

Each block carries a stable key — `sectionId:position`, position _within its
section_ — its section id and its kind. Derived rather than generated, so a
height measured from the DOM can be matched back to the block it came from
after a re-render, and editing one section renumbers nothing in any other. The
key and the kind are emitted into the markup (`data-resume-block`,
`data-resume-block-kind`) because measurement happens over the rendered
document: in the editor's DOM, and in the browser the PDF is printed from.

Four things follow, and each used to live one level up:

- **`break-inside-avoid` sits on the block, not on the entry.** Asking the
  browser to keep a job whole is asking it to _move_ the job whole, which is
  how a nine-bullet role throws itself onto the next sheet and wastes most of
  the one before it. The block is deliberately smaller than an entry, so a job
  may split between two of its own bullets.
- **Spacing is owned by the block.** `space-y-*` between entries, padding on the
  `<section>` element: a parent cannot space two children that have ended up on
  different sheets, and no element containing a whole section survived. Each
  block owns the gap _after_ itself, so a block arriving at the top of a page
  brings no gap with it.
- **A bullet is its own list.** One `<ul>` per bullet rather than one holding
  the job's nine, because an element cannot be in two places and a job split
  across a boundary asks exactly that of it. Every bullet is still a real list
  item inside a real list, on whichever sheet it lands, and the discs line up
  because the indent is a token rather than a position.
- **Selection is drawn around a _run_ of blocks** — see below.

`paginate` (`src/lib/paginate.ts`) is the pure function that turns measured
block heights into page assignments: greedy in document order, a block taller
than a page gets its own page and overflows rather than being dropped, and a
heading is never the last block on a page. Nothing calls it yet — measurement
and the page as an element are the tickets after this one. It is a pure
function precisely so a break can be proved from a test rather than from a
screenshot.

## Selection

Selection is **item-level, with sections separately selectable**: the header, a
section, or one row of a core section. A panel holding four jobs and twenty
bullets is unusable, and a panel holding one textarea is a great deal of
interface for one string.

Everything is keyed by **row identity, never by array index** — the whole point
of reordering is that an index means something different afterwards.

Two rules make selection work over a list of blocks rather than a tree:

- **The renderer wraps each _run_ of adjacent blocks that select the same thing
  in one click target.** An outline per block is five stacked boxes where the
  user selected one job. A run is computed rather than nested, so it can later
  be one _page's_ worth of a job that spans two — which no wrapper element could
  have been. The gap after a run is margin, not padding: an outline is drawn
  outside the padding and inside the margin, and the box has to end where the
  content does.
- **A block that selects nothing of its own is selected by its section.** A
  shape addressed a row at a time — a job, a school, a skills group — answers
  for its own blocks, and the innermost target still wins. Everything else is
  the section, because a rich-text paragraph and a tag row are edited _through_
  the section panel: a box around the heading alone stops at the rule while the
  panel edits the text under it, and clicking that text used to fall through to
  the page and clear the selection.

Selection clears by clicking past the document or through the panel's back
control. Without that, the resume-level panel — the only place a section is
added — would be unreachable after the first click.

## Editing

### One parser, two path flavours

`src/lib/resume-field-path.ts` owns the grammar and the writable-column list.
It is imported by the panel, the optimistic cache patch and the server
mutation; each of those once had its own copy of the rules, so adding an
editable field meant touching five places that had to agree. A hand-made
request cannot reach a column the panel would not offer, because the same
parser refuses it.

The template speaks in indices (`experience.1.name`) because that is what
react-hook-form paths look like; the mutation speaks in row ids
(`experience.<cuid>.name`) because an index does not survive reordering. Same
grammar, one parser — `withRow` swaps an index for an id, so an edit cannot land
on the wrong job if rows come back in a different order.

`section-content.ts` holds the other half: what each component type's payload
is, which paths address its content, and the `collection` describing how its
elements are added, removed and moved. That registry is what makes the panel
_generated_ rather than written — an eighth section shape is a registry entry,
not an eighth panel.

### Rich text is a constrained markdown subset

Bold, links and bullet lists, in a plain textarea with three toolbar buttons.
The stored value is exactly what was typed, so there is no sanitizer to get
wrong and `stripMarkdown` gives a parser clean text for free. A second document
model — an editing framework with its own formatting set — would have to be
reconciled with this one forever, for a feature nobody would notice. The honest
cost is that typing markdown reads as dated to some users, which is exactly why
the buttons are not optional: a phone keyboard is a bad place for asterisks.

A bullet list _inside_ rich text exists because markdown has one, but the app
never offers it as a rich-text action from the panel. A list of things gets one
home: the list component.

### Autosave: six details worth keeping

Persistence is **debounced autosave plus commit on blur**. A panel holds several
inputs and has no natural "done" moment, so a pause is the commit and blur
flushes what the pause has not sent. Save state — saving, saved, failed — is on
screen, because autosave without feedback is indistinguishable from data loss.

- **Rollback is per-field, not per-snapshot.** Reverting the whole cached resume
  would also undo edits that had already succeeded, so the mutation captures
  just the previous value of the field it is about to change.
- **A refused write rolls back the document, not the input.** The document is
  the preview and has to show what is stored, but the sentence the user typed
  stays in the panel until it saves or is typed over — a network error must not
  eat it. That text is remembered by path, so a success elsewhere cannot report
  the resume as saved while it is still only on screen, and leaving the page
  while any of it is outstanding warns first.
- **The refetch waits for pending keystrokes, not only for sent writes.** A
  write still waiting out its debounce counts as outstanding; otherwise typing,
  waiting for that save, and typing again during the refetch it triggered loses
  the second keystroke.
- **A structural write supersedes the pending writes inside what it rewrites.**
  `setBullets` and `setContent` carry every keystroke already, because the cache
  they are built from is patched as the user types; sending the debounced field
  write too would land it _after_ the reorder, at an index that by then names a
  different bullet. Removing a row drops writes to it for the same reason. Every
  other structural write flushes first instead.
- **Structural writes patch the cache too — except adding.** A new row's id is
  the server's to mint, and a locally invented one is a row the panel could
  select and then lose.
- **Both exits flush.** Unmount and `beforeunload` send what is pending rather
  than only cancelling the timer: a debounce that throws away its last keystroke
  on the way out is a debounce that eats sentences.

## The PDF

`renderResumePdf` renders the same component to a markup string and hands it to
Playwright's `page.setContent` — the browser never navigates. No round trip, no
session to forward, and no requirement that the server be able to reach its own
public URL, which is otherwise a wall the moment the PDF needs authenticated
data.

`@react-pdf/renderer` is not an option here and should not be reintroduced: it
needs a second template tree and cannot use Tailwind, which puts the document
back to having two definitions of itself.

The one cost of `setContent` is that the shell needs the compiled Tailwind CSS
inlined. It is read off `.next/static` at request time (`compiled-css.ts`)
rather than hand-maintained, so it cannot drift from what the app ships. The
fonts are embedded into that sheet as data URIs, because a print has no origin
and no network.

## What is tested, and where

Assertions belong at the highest seam that can see the thing being asserted.

- **`src/lib/paginate.test.ts`** — the break policy, as pure arithmetic. No DOM.
- **`src/server/modules/profile/resume-html.test.ts`** — seam 3, the document as
  a markup string: the PDF shell and the structural invariants.
- **`.../resume-sections.test.ts`** — seam 3 again, the section rendering
  system, the block list, and the per-style invariants: single column, no
  layout table, no text as an image, contact URLs in the text.
- **`src/components/resume-document.test.tsx`** — click targets, which are the
  one thing seam 3 cannot see, because `renderResumeHtml` renders read-only.
- **`src/components/resume-tokens.test.ts`** — asserts against the component
  _sources_ that no size, weight, case, colour or spacing literal lives in a
  resume component. A literal that only shows up under one style at one width is
  exactly what a render test would miss.
- **`.../pdf-fonts.test.ts`** — drives real Chromium: which face is actually in
  use, that the page fetched nothing to get it, and that nothing overflows the
  paper. It skips without a build; `npm run test:pdf` builds first and turns the
  skip into a failure.
- **`src/lib/resume-field-path.test.ts`** and **`src/server/api/routers/resume.test.ts`**
  — the path grammar and the server writes, including every rejected shape.

## How it got here

The path is recorded because several decisions below look arbitrary without it,
and because two of them were reversed.

**Steps 1–2 — an addressable data model, and one template.** `work.description`
(one column, split on `". "` at render time) became `work.bullets`, so bullet 3
of job 2 became a real addressable thing rather than a substring boundary. The
skeleton `Resume`, `Resume2InChat` and eight dead subcomponents collapsed into
`ResumeDocument`; `resume.tsx` went from 1233 lines to 195, and later to
nothing.

**Step 3 — inline editing, since removed.** `<Editable path="experience.0.bullets.2" />`
swapped text for an input in place, with a `ResumeFieldPath` template-literal
type filtering react-hook-form's `FieldPath` down to paths whose value is a
string. It was replaced wholesale by selection-and-panel in spec D (#50):
click-to-swap needed the A4 page at full size, which a phone does not have.
`Editable`, `PlainField`, the `onEdit` prop threaded through the template, the
`canEditPath` click gate and the path type all went with it.

**Step 4 — autosave.** Landed as blur-only, now debounced-plus-blur. The
six details above are what survived.

### Only the snapshot was editable

`skill` and `contact` once hung off `profile` rather than `resume`, and email
lived on `user` — so they were shared by every resume the profile owned, and
editing one from a resume editor would silently rewrite the others. The editor
was therefore snapshot-only: `profession`, experience and education were live;
skills, contact details and name rendered read-only.

**Since spec B (#48) a resume owns all of it.** `skill` and `contact` both carry
a nullable `resumeId`: a row with it set is one resume's copy, a row with it
null is the account's master copy, which seeds a new resume and is never read at
render time. `contact` also carries `full_name` and `email`, so a saved resume
still says what it said when it was sent even after the account changes its
name. Editing the account deliberately does not reach an existing resume —
`resume.refreshFromAccount` pulls current details in when that is actually
wanted.

This is the change anything reasoning about stale scores should know about: the
scored content is now snapshotted per resume.

### Verified

Steps 3–4 were checked by two throwaway probes, before the repo had a test
runner. Both are committed now, and the counts are the origin rather than the
current total — `src/server/api/routers/resume.test.ts` and
`src/lib/resume-field-path.test.ts` have both grown since.

- **Server, 17 checks** against the live database through the real router,
  including `assertOwnsResume`: writes land on the right column and replace
  exactly one bullet; and `email`, `skills.0.all`, `profileId`, `resumeId`, the
  bare `bullets` array, an out-of-range index, a non-numeric index, a
  trailing-dot index, an unknown section, a row belonging to another resume, and
  another user's resume are all rejected.
- **Parser, 32 checks**: every accepted path shape, 21 rejected ones, and the
  index→id→reparse round trip.

### Page overflow

`ResumeDocument` hardcoded `h-[29.7cm]` with `overflow-hidden`, so content past
one page was **silently clipped** — no scrollbar, no warning, the text simply
was not in the document, and therefore not in the PDF's text layer either. The
fixed height and `overflow-hidden` are gone and the page is normal flow.

This is why a block taller than a page is given its own page and allowed to
overflow rather than being cut: a page that is visibly too full is a bug the
user can see, and a page that silently ate a paragraph is not.

### Reversed along the way

| Decision         | Then                          | Now                                                                  |
| ---------------- | ----------------------------- | -------------------------------------------------------------------- |
| Edit interaction | Inline field swap             | Selection and panel (#50) — the document is a read-only live preview |
| Persistence      | Autosave on blur              | Debounced autosave plus commit on blur                               |
| Rich text        | Plain text only               | A constrained markdown subset                                        |
| Entry breaking   | `break-inside-avoid` per job  | Per block (#62) — keeping a job whole is what moves it whole         |
| PDF engine       | Puppeteer + a querystring URL | Playwright's Chromium + `setContent` over the same React component   |
