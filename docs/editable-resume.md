# Editable resume

Plan for turning the resume from a write-once PDF export into a document you can
click into and edit. Steps 1–4 are done; steps 5–6 are the remaining work.

## Why this refactor exists

There are two divergent resume templates today, and the one the PDF uses cannot
be edited:

- **`Resume`** (`src/components/resume.tsx:9`) renders an *empty skeleton*.
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

| Question | Decision |
| --- | --- |
| Edit interaction | **Inline field swap.** Click a text node and that single element becomes a plain input/textarea in place, same font and position. Plain text only — no rich text, no `contentEditable`. |
| Persistence | **Autosave on blur.** Each field commits via a tRPC mutation when it loses focus. No dirty-state tracking, no unsaved-changes guards. |
| PDF engine | **Puppeteer + `page.setContent`**, rendering the same React component. `@react-pdf/renderer` has already been dropped from `package.json` — do not reintroduce it; it needs a second template tree and can't use Tailwind. |

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
*editable* — a blank bullet would otherwise collapse to a zero-height element
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

A saved resume snapshots its own `work` / `school` rows via `resumeId` — but
**`skill` and `contact` have no `resumeId`, and email lives on `user`.** Those
are shared by every resume the profile owns, so editing one from a resume editor
would silently rewrite the others.

So the editor is snapshot-only: `profession`, experience and education are live;
skills, contact details and name render read-only. Both the click target
(`canEditPath`) and the server write derive that from **one** parser —
`src/lib/resume-field-path.ts` — so the UI and the write can't disagree about
what's editable, and a hand-made request can't reach a column the template
wouldn't offer.

Making the shared fields editable means snapshotting them first: `resumeId` on
`skill`, a per-resume contact snapshot, a migration and a backfill. That's its
own step, not a corner of this one.

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
Postgres felt like, so indices meant something different on each fetch. **`id`
is stable but arbitrary; a real `position` column is still owed** on `work` and
`school`, and until it exists the editor can't offer reordering.

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

Two probes, both run and passing, neither committed (there's no test runner in
this repo — worth adding).

- **Server, 17 checks** against the live database through the real router,
  including `assertOwnsResume`: writes land on the right column and replace
  exactly one bullet; and `email`, `skills.0.all`, `profileId`, `resumeId`, the
  bare `bullets` array, an out-of-range index, a non-numeric index, a
  trailing-dot index (which `Number()` coerces to 0), an unknown section, a row
  belonging to another resume, and another user's resume are all rejected.
- **Parser, 32 checks**: every accepted path shape, 21 rejected ones, and the
  index→id→reparse round trip.

### Still owed

- **The dashboard chat preview still can't persist.** Its `onEdit` writes to
  react-hook-form state, and `handleSubmit(onSubmitSaveResume)` sits on the
  `<form>` while the only button is `type="button"` — so `resume.create` never
  fires. That predates this work. The editor is the path that persists; the
  preview is still save-less.
- `Editable` keys bullets by array index, so reordering or deleting a bullet
  would carry edit state to the wrong row. Only matters once add/remove exists.
- No add/remove for bullets, jobs or schools — `updateField` replaces existing
  strings only.

## Step 5 — PDF via `setContent`

Replace `page.goto(url)` + `$$eval` with a direct render:

```ts
const html = renderToStaticMarkup(<ResumeDocument data={input} />)
await page.setContent(shell(html, tailwindCss), { waitUntil: "load" })
const pdf = await page.pdf({ format: "A4", printBackground: true })
```

**Deletes:** `createEndpoint` and `insertValuesOnPage` in
`src/pages/api/resume/pdf.ts` (~200 lines), the whole querystring protocol, and
the `/pdf` route.

**Wins beyond the line count:** no network round-trip, so it's faster; and
Puppeteer no longer needs a session, which is otherwise a wall the moment the
PDF needs authenticated data.

**The one new problem:** the shell needs the compiled Tailwind CSS inlined.
Read it off the built stylesheet rather than hand-maintaining a copy.

This step is worth doing on its own even if the editing work slips.

## Step 6 — Page overflow

`ResumeDocument` hardcodes `h-[29.7cm]` with `overflow-hidden`
(`src/components/resume.tsx:28`). Content past one page is **silently
clipped** — no scrollbar, no warning, the text just isn't there.

Today that's latent. Once users type freely they will hit it constantly and have
no idea why their text vanished.

- Replace the fixed height + `overflow-hidden` with normal flow.
- Add `break-inside: avoid` to section blocks so a job doesn't split across the
  page boundary.
- Draw a visible page-boundary rule in the editor, so overflow is something the
  user can see rather than something that eats their work.

## Suggested order

Steps 2–4 deliver the editable resume. Steps 5–6 make the PDF agree with it.
They're separable, and step 5 stands alone.
