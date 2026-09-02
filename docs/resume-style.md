# The resume style

Three typographic directions, all shipped, chosen per resume. This is what each
one is for, what was rejected, and where the values live — so that a later
change is argued rather than drifted into.

## The position

Resume templates in this market are either Word defaults or sidebar layouts with
skill bars, headshots and icon columns. The second list is, near-verbatim, the
documented set of things that break resume parsing. An app whose thesis is
honesty about how a document parses cannot ship a flagship template that fails to
parse, so the usual lever for "distinctive" is unavailable.

**Distinctiveness is carried entirely by typography, rhythm and hierarchy, inside
strictly single-column, parser-clean markup.** This is genuinely underused —
every competitor is either default or gimmick — and it costs nothing
structurally.

Excluded, permanently: sidebars, multiple columns, tables used for layout,
graphics, text rendered as an image, letter-spaced headings, and contact details
in a header or footer region. `src/server/modules/profile/resume-html.test.ts`
asserts each of these per style, because a style is exactly the kind of change
that would quietly reintroduce one. The standing temptation is the layout table:
repeating a section heading at the top of every page it continues onto is what a
`thead` is _for_. It is computed from the page assignment instead — see [the
continued heading](./editable-resume.md#the-continued-heading-is-computed-not-repeated-by-the-browser).

## The shared layout

All three styles share it: centred header, full-width sections, dates left and
content right, one column. That layout is what parses, and it is not the
variable.

Which leaves a differentiation budget of exactly five axes:

| Axis                      | Tokens                                                                      |
| ------------------------- | --------------------------------------------------------------------------- |
| Body type                 | `--resume-font-body`, `--resume-font-heading`                               |
| Heading treatment         | `--resume-heading-weight`, `--resume-heading-case`, and the scale           |
| Rule weight and placement | `--resume-rule-weight`, `--resume-rule-gap`, `--resume-space-heading`       |
| Date-column rhythm        | `--resume-left-column-width`, `--resume-date-scale`, `--resume-date-weight` |
| One accent                | `--resume-ink-accent`                                                       |

`--resume-font-heading` is the half of the body-type axis all three directions
currently decline: each takes its headings as a _variation_ on its own body
face — weight, case and size — rather than introducing a second one. It is a
live axis, not a dead token; giving a direction a separate heading face is one
declaration in its overlay and nothing else. See _Four ways this mechanism
bites_ for why it is declared where it is.

The page the layout sits on is shared too, and it is not one of the five axes:
all three directions print the same margin on the same paper, and reflow is the
only thing that re-values it. A direction that wanted its own page margin would
be re-valuing a token rather than asking for a mechanism, which is the property
worth keeping. What the page is made of, and why, is
[editable-resume](./editable-resume.md#the-page-is-a-real-sheet-65-66).

The date range **wraps** inside its column rather than being held on one line.
The column is a fixed width the style picks, and a range longer than it used to
sit on top of the employer name — so the width is a decision a style gets to
make freely, and a pathological range costs a second line rather than the
layout.

Three is close to the honest ceiling of what that budget supports. It is the
reason the set is three and not six.

## The three directions

### Classic — traditional

**Source Serif 4 throughout.** For the industries that still read a serif: law,
finance, academia, anywhere a document is expected to look like a document.

Identity comes from the face and from a ledger rhythm — a right-aligned date
column resolving against a hairline (0.75pt) rule under every heading. The
profession and each role sit in italic, which a serif has and the two sans faces
do not. Set at 10.5pt rather than 10pt because a serif at the same point size
reads smaller. Accent `#1b2a41`, a deep ink navy — read by the name, the
headings and the hairline rules, and by nothing else.

The strengths block draws as outlined marks rather than filled pills: a grey
pill on a serif document reads as software. The outline takes the text ink, not
the accent: pointing `--resume-tag-border-ink` at `--resume-ink-accent` is the
one-accent rule broken by indirection, and `resume-tokens.test.ts` now scans
each overlay for exactly that.

### Standard — neutral

**Geist, the app's own face.** The default, and the descendant of the document
this app already shipped: uppercase name, uppercase headings, a 1px rule under
each one.

Retuned onto the scale rather than redesigned, so a resume written before styles
existed still looks like itself. Nothing about it is a statement, which is the
point — it is the one to pick when the industry is unknown. Accent `#111827`,
which is near-black and reads as ink.

### Modern — contemporary

**Manrope.** For product, design and engineering.

**No rules anywhere.** Hierarchy is carried entirely by weight, size and space,
which is the departure. Headings are sentence case at weight 800, so they read as
a different voice from the body rather than as the body shouted. The date column
is narrow and set a step below the body, so the eye lands on the employer
first — a size decision, not a colour one. The rhythm is 1.3×
the shared step — the most generous of the three, and the reason it is also the
one most likely to run to a second page on a dense history.

Accent `#3f3f46`, a warm slate.

## What was rejected

**Specifying a style in prose, then building it.** The constraint that kills
distinctive resume design is not taste, it is that you have one A4 page and a
full work history. That only becomes visible against real content.

**Copying a reference and differentiating from it.** A slower route to a worse
answer.

**Ranking three directions and shipping the winner.** The exploration was going
to build three and discard two. Shipping all three deletes the discard step
rather than tripling the design work. What it genuinely adds is persistence, a
picker, and a hand-verification matrix three times the size.

**Differentiating on colour.** See below.

**A fourth style.** Five axes do not support six distinguishable documents.

## Colour carries no information

There is one colour token, `--resume-ink-accent`, and it is read by at most the
name, the section headings and the rules. Each style fixes its own value; none is
bright. **No style may diverge on any other ink** — the tempting exception is
de-emphasis (a greyer date column, a softer link), and that is precisely the
case the rule exists for: hierarchy carried by colour is hierarchy a photocopy
loses. Modern's date column earns its recession from `--resume-date-scale`
instead.

The invariant that makes this safe: **the document printed greyscale loses
nothing.** Hierarchy is size and weight, and the rules take the accent as a solid
fill rather than as a tint. A style that needs its accent to be legible has
failed the black-and-white requirement, not earned an exception to it —
`src/components/resume-tokens.test.ts` holds every accent to a luminance ceiling,
and holds each overlay to declaring no ink but the accent — and to not pointing
any _other_ token at it either. That second half exists because scanning ink
names alone missed it once: Classic outlined the strengths block in the accent
through `--resume-tag-border-ink`, which is the rule broken by indirection
rather than by declaration.

There is no user-facing accent picker, deliberately. It is a second picker, a
second column, and the part most likely to make output look worse rather than
better. Ship three strong styles and see whether anyone asks.

## How a style is expressed

**A style is a class that re-values tokens** — the same mechanism
`.resume-reflow` already uses. Not a component variant, not a branch inside a
renderer. No component learns that styles exist: `ResumeDocument` puts one
overlay class on the document root the way it already puts one mode class there,
and everything below reads tokens.

The contract and its neutral values are on `:root` in `src/styles/global.css`;
each direction is a `.resume-style-*` block below it. The axes Tailwind has no
theme key for — text case, font style, text alignment — are the `.resume-*`
component classes at the foot of the same file, so they sit beside the tokens
they read.

If a direction cannot be expressed as a token overlay, that is a finding about
the token set, and the fix is a new token rather than a conditional in markup.

### The scale is a scale

Sizes are one base and one ratio, so they relate to each other instead of being
picked individually — a style tunes `--resume-text-base` and
`--resume-scale-ratio` and the whole document moves together. The name is the
deliberate exception: it is a display size, not a step, so it gets its own
multiplier (`--resume-name-steps`) rather than being forced onto a scale it would
overshoot.

Spacing is one step times `--resume-rhythm`, which is the density knob a style
turns. That is why Modern's generosity is one number.

### Four ways this mechanism bites

Each of these was a real bug during the build — all four rendered a plausible
document while the stylesheet read as though something else was happening — and
each is now covered by a test that was checked against the bug it guards:

0. **A derived token is substituted where it is _declared_.** The whole scale
   lived on `:root` as `--resume-text-body: var(--resume-text-base)`, which
   freezes at `:root`'s base and inherits _that_. Every overlay's base size,
   ratio and rhythm did nothing: all three styles rendered at identical sizes
   and spacing. The derivations now live on `.resume-document`, which is the
   element the style class is on — declared before the overlays, so a style
   overriding a derived value directly still wins.
1. **A composed class name is invisible to Tailwind.** `` `resume-style-${style}` ``
   compiles, renders, and produces no CSS — Tailwind decides what to emit by
   scanning source for class names as plain strings. The overlays were silently
   dropped and every style rendered as the default. The names are spelled out in
   `resumeStyleCatalog`.
2. **A `var()` inside a custom property resolves where it is _declared_.**
   `--resume-font-heading: var(--resume-font-body)` on `:root` resolves against
   `:root`'s body face, so overriding only `--resume-font-body` in an overlay
   left every style's headings in Geist. It is declared on `.resume-document`
   instead — the element the overlay class is on, where the style's own body
   face is in scope. All three directions therefore take their headings as a
   variation on the body face rather than as a second one; an overlay that
   wants a separate heading face sets `--resume-font-heading` directly, and
   nothing else has to change.
3. **Preflight gives `hr` a 1px top border.** A style setting
   `--resume-rule-weight: 0` still drew a line, which is precisely Modern's
   whole departure. The reset lives in `.resume-rule` beside the tokens rather
   than as a `border-0` literal in the component.

### Both render modes, every style

`.resume-reflow` re-values the base size and the page margins, and nothing else.
The ratio, the rhythm, the faces and the weights stay the style's — so the phone
is a preview of the same document rather than a second design. It is declared
_after_ the style overlays because the two are both one class on the same
element, and the later rule is the one that wins.

### Cover letters will read this same token set

A cover letter is the same header, the same accent, the same scale and one
`richText` section. So no token assumes resume-specific structure, and a style
must stay expressible without a date column or a section rule. Nothing about
cover letters themselves is built here.

## Fonts are embedded, not merely self-hosted

`render-resume-pdf.ts` inlines the compiled stylesheet into `page.setContent`,
which gives the page an `about:blank` origin. A compiled `@font-face` says
`url(../media/Geist-abc123.woff2)`, and against no origin that resolves against
nothing: the fetch fails and the PDF prints in a system fallback. Self-hosting
does not help — the print has no network and no base URL to be relative to.

Two things were wrong, and both are fixed:

1. **`embed-fonts.ts`** reads every font reference off the build output and
   rewrites it as a `data:` URI, once per process, before the browser sees the
   CSS. `render-resume-pdf.ts` then waits on `document.fonts.ready` so
   `font-display: swap` cannot print a fallback frame.
2. **The faces are declared as plain `@font-face` rules** in `global.css`
   against files the app serves, rather than through `next/font`. `next/font`
   hands back a generated class name that the print's `about:blank` page has no
   way to carry, and the `geist` package's export evaluates to `undefined`
   inside the PDF route's server bundle — so the shell no longer uses it
   either, and both the app and the print read the same `:root` variables.

The faces are committed as `.woff2` under `public/fonts/` rather than downloaded
at build time: the PDF embeds whatever bytes are on disk, and a face the build
fetched is a face that can fail to fetch. All three families are OFL 1.1, which
permits embedding in a generated document — recorded in
`public/fonts/LICENSE.md`. Licensing was checked before the faces were chosen.

`src/generated/print-css.ts` is the single definition of the printed stylesheet,
imported by both the PDF route and `pdf-fonts.test.ts`, so the test cannot drive
a sheet the print does not. It is build output — gitignored, and regenerated by
`npm run generate:css`, which `prebuild`, `predev` and `pretest` all run. Edit
`global.css` or a component's classes in a running dev server and the printed
sheet is stale until that regenerates.

## Choosing a style

Three buttons in the editor toolbar, labelled with the register each direction
is for. **Pointing at one previews it** — the document beside the picker redraws
in that direction, and leaving puts it back. Only a click persists.

What is previewed is the user's own resume: their real history, at real length,
on a real page. Thumbnails were rejected for the same reason the directions were
explored against real content rather than specified in prose — the constraint
that decides whether a direction works is one A4 page against a full work
history, and a thumbnail is exactly the size to hide it. Three miniatures that
read the same at a glance are not a choice.

The previewed stamp is applied at the one render site in the editor, so it
cannot leak: the PDF button prints what is stored, not what the pointer happens
to be over. A touch screen has no hover, so a tap chooses directly and the
document still redraws immediately — the desktop path improves on that fallback
rather than replacing it.

There is no accent picker, deliberately — see _Colour carries no information_.

## Style is stored on the resume

Two columns on `resume`: `style` and `accent`, defaulting to the Standard
stamp — `standard` and `#111827` — so a row written before styles existed picks
up the direction it was already closest to (migration `0009_resume_style`).

**Not byte-identical to what those rows used to render as.** Standard is a
retune of the old document onto the scale, not a copy of it: the base size, the
ratio, the rhythm and the left column all moved. Existing resumes therefore
render as Standard rather than as their former selves, which is as close as
valuing the token set allows and is the cost the spec accepted when it asked
for the values to be decided. The defaults are derived from
`resumeStyleCatalog` in `schema.ts` rather than written out again; the
migration is frozen SQL, so `resume-tokens.test.ts` holds the two together and
a retune of Standard's accent means writing a migration.

Not on the account. A saved resume owns everything it renders, and reading the
style through to the account would mean a resume already sent changes appearance
after the fact. The accent is _copied_ onto the row rather than referenced, for
the same reason: retuning a direction later must not repaint a document someone
already sent. `ResumeDocument` applies the stored accent as a token override on
the document root, which wins over the overlay's own value.

## What is tested, and what is not

Visual design is judged by a person. Automated tests here would assert that the
design is what it is, which is worthless. What is tested is that a style cannot
break the document's structural guarantees:

- `resume-html.test.ts` — the structural invariants, per style, against a
  document holding **every** section shape including the strengths block and the
  hobbies icon row; plus a nearly-empty document and a long-name/long-company/
  long-bullet document, per style.
- `resume-tokens.test.ts` — **no component emits a literal size, spacing, weight,
  case, colour or rule value where a token is expected.** This is the
  load-bearing one: it is the entire reason style three cost less to build than
  style one, and the first hardcoded value is where that stops being true. It
  also asserts each overlay actually re-values all five axes, that every accent
  survives greyscale, that no other token borrows `--resume-ink-accent` through
  a `var()`, and that the column defaults and the frozen `0009` migration both
  still agree with the catalog.
- `embed-fonts.test.ts` — the rewrite that makes the print use the face the
  preview shows.
- `pdf-fonts.test.ts` — drives the same `about:blank` page the PDF route drives
  and asks Chromium what it ended up using. Four things markup cannot see: that
  each style's face is embedded **and loaded**, that the page fetched nothing to
  get it, that nothing overflows its container, and that **the scale actually
  moves between styles** rather than being frozen on the root. Not a screenshot
  suite — no pixel is asserted, only relationships the design states on purpose
  — and it skips when the project has not been built, warning that it did.
  `npm run test:pdf` builds first and sets `REQUIRE_PDF_TESTS=1`, which turns
  that skip into a failure: this is the only suite standing between the print
  and a system fallback, so it must not be able to pass by asserting nothing.

No visual regression testing, no screenshot diffing, no pixel assertions. The
design is changing by intent, and a screenshot suite would only generate noise.

### Still to be verified by hand

Fifteen checks — for each of the three styles: a full one-page resume, a nearly
empty one, and a two-page one; printed in black and white; the browser preview
and the generated PDF compared for identical rendering; and long names, long
company names and long single bullets checked for overflow. That is the real cost
of shipping three, and it is not something a test can stand in for.

One more the picker adds: that previewing a direction and then choosing it land
on the same document. They normally must — both stamp the direction's current
accent — but a resume saved before a retune keeps the accent it was sent with,
so releasing the pointer without clicking is the one moment the two legitimately
differ.
