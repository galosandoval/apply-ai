/**
 * A date on a resume: the subset a column may hold, and the words a document
 * prints from it.
 *
 * A resume date is a **partial** date — a job started in 2017, or in September
 * 2017, and only sometimes on a particular day — so it is stored as one of
 * `YYYY`, `YYYY-MM` or `YYYY-MM-DD` and never as a `date`. Precision is carried
 * by the string's own length, which is why no column records it separately.
 *
 * The shape is the one HR Open (`FormattedDateTimeType`) and JSON Resume
 * independently landed on. We are not adopting either standard; we are taking
 * the field they agree about — see #71.
 *
 * "Still here" is deliberately not one of these values. `Present` is a
 * *rendering* of a missing end date, not a date, and storing it in the column
 * is what made "is this job current?" and "when did it end?" the same
 * unanswerable question. The `current` flag holds the first, this holds the
 * second, and `formatResumeDateRange` puts them back together.
 */

import { type Locale, toLocale } from "~/i18n/routing"

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, and nothing else. */
export const resumeDatePattern =
  /^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/

/** How much of a date the stored value actually claims. */
export type ResumeDatePrecision = "year" | "month" | "day"

/** True when `value` is a date a column may hold. Empty is not — absent is. */
export function isResumeDate(value: string) {
  return resumeDatePattern.test(value)
}

/** The precision `value` carries, or `null` when it is not a resume date. */
export function resumeDatePrecision(value: string): ResumeDatePrecision | null {
  if (!isResumeDate(value)) return null

  if (value.length === 4) return "year"

  return value.length === 7 ? "month" : "day"
}

/**
 * The words a locale uses for an end date that has not happened.
 *
 * Copy in code rather than in the message files, unlike every other string the
 * app shows: this is drawn from `resume.language` while the document renders,
 * and the document renders synchronously — inside a server component for the
 * PDF, where `next-intl`'s async message loading is not available and the
 * *request's* locale would be the wrong answer anyway. `Record<Locale, …>`
 * makes the next locale a compile error here rather than an English word on a
 * Spanish resume.
 */
const currentTerm: Record<Locale, string> = {
  en: "Present",
  es: "Actualidad"
}

/**
 * The month names each locale answers to, lowercased, longest first.
 *
 * Written out rather than derived from `Intl`: this reads what a *user* typed
 * or a model returned, which includes the abbreviations `Intl` never produces
 * (`Sept`) and the ones it produces with a trailing dot (`sept.`). Matching is
 * by prefix, so every abbreviation of a listed name is covered by the name.
 */
const monthNames = [
  ["january", "enero"],
  ["february", "febrero"],
  ["march", "marzo"],
  ["april", "abril"],
  ["may", "mayo"],
  ["june", "junio"],
  ["july", "julio"],
  ["august", "agosto"],
  ["september", "septiembre", "setiembre"],
  ["october", "octubre"],
  ["november", "noviembre"],
  ["december", "diciembre"]
]

/** The 1-based month a written month name means, or `null`. */
function monthFromName(name: string) {
  const cleaned = name.toLowerCase().replace(/\.$/, "")

  if (cleaned.length < 3) return null

  const index = monthNames.findIndex((names) =>
    names.some((full) => full.startsWith(cleaned))
  )

  return index === -1 ? null : index + 1
}

const pad = (value: number) => String(value).padStart(2, "0")

/**
 * Best-effort read of a free-text date into the stored subset, or `null` when
 * the text does not say a date this app can stand behind.
 *
 * Used by the PDF import and by the generation, both of which hand back
 * whatever a resume or a model wrote. `null` is not a failure to handle
 * quietly: the caller keeps the raw text so a user can correct it, because a
 * date silently blanked on a resume someone already sent is the worst outcome
 * available.
 */
export function normalizeResumeDate(raw: string): string | null {
  const value = raw.trim()

  if (!value) return null

  if (isResumeDate(value)) return value

  const named = /^([\p{L}]+)\.?\s+(\d{4})$/u.exec(value)

  if (named?.[1] && named[2]) {
    const month = monthFromName(named[1])

    return month ? `${named[2]}-${pad(month)}` : null
  }

  const numeric = /^(\d{1,4})\s*[/-]\s*(\d{1,4})$/.exec(value)

  if (numeric?.[1] && numeric[2]) {
    // Whichever side is the four-digit number is the year: `09/2017` and
    // `2017/09` are both in production data and mean the same thing.
    const [first, second] = [numeric[1], numeric[2]]
    const year = first.length === 4 ? first : second
    const month = Number(first.length === 4 ? second : first)

    return year.length === 4 && month >= 1 && month <= 12
      ? `${year}-${pad(month)}`
      : null
  }

  return null
}

/** The words each locale writes where an end date would go, lowercased. */
const currentTerms = ["present", "current", "now", "actual", "actualidad"]

/** True when free text is the user's way of saying the entry has not ended. */
export function isCurrentTerm(raw: string) {
  return currentTerms.includes(raw.trim().toLowerCase())
}

const formatOptions: Record<ResumeDatePrecision, Intl.DateTimeFormatOptions> = {
  year: { year: "numeric" },
  month: { year: "numeric", month: "short" },
  day: { year: "numeric", month: "short", day: "numeric" }
}

/**
 * One stored date as the document prints it, in the resume's own language.
 *
 * A value outside the subset is printed **verbatim**. The #71 migration leaves
 * a date it could not read exactly as the user typed it, and a resume that
 * renders a blank where a date used to be is precisely what that decision was
 * made to avoid — so display degrades to the raw string rather than to nothing.
 */
export function formatResumeDate(value: string, language: string) {
  const precision = resumeDatePrecision(value)

  if (!precision) return value

  const [year, month = "1", day = "1"] = value.split("-")

  // UTC throughout: a date with no time is not a moment, and letting the
  // runtime's zone decide is how `2017-09-01` prints as August.
  const at = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))

  return new Intl.DateTimeFormat(toLocale(language), {
    ...formatOptions[precision],
    timeZone: "UTC"
  }).format(at)
}

/**
 * Both ends of one entry's range, formatted.
 *
 * `current` wins over whatever the end column holds: the two disagreeing is
 * the state the checkbox exists to make unrepresentable, and the flag is the
 * half of it the user set on purpose.
 */
export function formatResumeDateRange(
  entry: { startDate: string; endDate: string; current?: boolean | null },
  language: string
) {
  return {
    start: formatResumeDate(entry.startDate, language),
    end: entry.current
      ? currentTerm[toLocale(language)]
      : formatResumeDate(entry.endDate, language)
  }
}

/**
 * One entry's dates and flag, as they arrive from something *reading* a resume
 * — the PDF import, or a generation drafted off the account's history.
 *
 * A model hands back whatever the document said, which is `Sept 2017` and the
 * word `Present` far more often than it is `2017-09`. This is the one place
 * that is turned into the shape the columns hold: the dates into the subset,
 * and "still here" out of the end-date field and into the flag it belongs in.
 *
 * A date it cannot read is **kept**, not blanked — the same decision the #71
 * migration made. Every imported entry is reviewed by the user before it is
 * saved, and a field still holding what their resume said is one they can
 * correct; an empty one is a date they have to remember.
 */
export function normalizeEntryDates(entry: {
  startDate: string
  endDate: string
  current?: boolean
}) {
  const stillHere = Boolean(entry.current) || isCurrentTerm(entry.endDate)

  return {
    startDate: normalizeResumeDate(entry.startDate) ?? entry.startDate.trim(),
    endDate: stillHere
      ? ""
      : (normalizeResumeDate(entry.endDate) ?? entry.endDate.trim()),
    current: stillHere
  }
}

/**
 * The same normalization, spread back over the entry it came from.
 *
 * Two readers need exactly this — the generation and the PDF import — and both
 * apply it as a zod transform on an entry they have just parsed, which is the
 * one reason it is a named function rather than three lines in each of them.
 */
export function withNormalizedDates<
  Entry extends { startDate: string; endDate: string; current: boolean }
>(entry: Entry) {
  return { ...entry, ...normalizeEntryDates(entry) }
}

/**
 * A stored date as a sortable number of months since year zero, or `null` when
 * it is not a date this app can read.
 *
 * Months rather than a `Date` because that is the finest unit a resume
 * actually claims — and a year-only date is read as that year's January, which
 * is the earliest moment it could mean.
 */
function monthIndex(value: string) {
  if (!resumeDatePrecision(value)) return null

  const [year, month = "1"] = value.split("-")

  return Number(year) * 12 + (Number(month) - 1)
}

/**
 * Orders two stored dates, earliest first.
 *
 * Compared as strings, which is exactly right for this subset and is the reason
 * it was chosen: the fields are fixed-width and zero-padded, so `2016` sorts
 * before `2017-01` and `2017-09-04` before `2017-09-05` without any of them
 * being parsed. Comparing by month would have quietly called two days in the
 * same month equal.
 *
 * A date nobody can read sorts **last**: it cannot be placed on the timeline,
 * and guessing where it goes would displace an entry whose date is known. The
 * #71 migration leaves such values in place, so this has to have an answer for
 * them.
 */
export function compareResumeDates(a: string, b: string) {
  const left = isResumeDate(a)
  const right = isResumeDate(b)

  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1

  if (a === b) return 0

  return a < b ? -1 : 1
}

/**
 * Orders entries the way a resume reads: most recent first.
 *
 * The order the user maintains by hand today, as `position`. Nothing consumes
 * this yet — it is what the typed column made possible, and what scoring will
 * sort by.
 */
export function compareByStartDate(
  a: { startDate: string },
  b: { startDate: string }
) {
  return compareResumeDates(b.startDate, a.startDate)
}

/**
 * Whole months from one stored date to another, or `null` when either is
 * unreadable.
 *
 * The employment-gap question: an entry that ended `2020-03` and one that
 * started `2020-12` is a nine-month hole, which is over the six months
 * `docs/ats-score.md` records 49% of employers knocking out on. Negative when
 * the dates are the other way round — an overlap is a real answer, not an
 * error.
 */
export function monthsBetween(from: string, to: string) {
  const start = monthIndex(from)
  const end = monthIndex(to)

  return start === null || end === null ? null : end - start
}

/**
 * What a *column* will take: a date in the subset, or nothing at all.
 *
 * Empty is writable because the editor inserts blank rows and a current entry
 * has no end date. Whether an entry is *finished* — the end date required
 * unless `current` — is a question about a completed form, and belongs to the
 * insert schemas rather than to the column.
 */
export function isWritableEntryDate(value: string) {
  return value === "" || isResumeDate(value)
}
