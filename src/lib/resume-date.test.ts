import { describe, expect, it } from "vitest"
import {
  compareByStartDate,
  compareResumeDates,
  formatResumeDate,
  isWritableEntryDate,
  monthsBetween,
  normalizeEntryDates,
  formatResumeDateRange,
  isCurrentTerm,
  isResumeDate,
  normalizeResumeDate,
  resumeDatePrecision
} from "./resume-date"

/**
 * The typed date, both ends of it: what the column may hold, and what the
 * document prints from it.
 *
 * Both halves are here rather than split across two files because they are
 * inverses — a value this module refuses is a value nothing may write, and a
 * value it refuses to recognise is one the formatter has to print verbatim
 * anyway. #71 turned four `text` columns into this subset; these are the
 * assertions that say which strings are on which side of it.
 */

describe("isResumeDate", () => {
  it.each(["2017", "2017-09", "2017-09-04", "1999-12-31", "2020-01-01"])(
    "accepts %s",
    (value) => {
      expect(isResumeDate(value)).toBe(true)
    }
  )

  it.each([
    "",
    "Present",
    "Sept 2017",
    "2017-9",
    "2017-13",
    "2017-00",
    "2017-09-32",
    "2017-09-00",
    "17-09",
    "2017-09-04T00:00:00Z",
    " 2017 ",
    "2017/09"
  ])("refuses %s", (value) => {
    expect(isResumeDate(value)).toBe(false)
  })
})

describe("resumeDatePrecision", () => {
  it("reads precision off the value's own length", () => {
    expect(resumeDatePrecision("2017")).toBe("year")
    expect(resumeDatePrecision("2017-09")).toBe("month")
    expect(resumeDatePrecision("2017-09-04")).toBe("day")
  })

  it("has no precision for anything outside the subset", () => {
    expect(resumeDatePrecision("Sept 2017")).toBeNull()
  })
})

describe("normalizeResumeDate", () => {
  it.each([
    ["2017", "2017"],
    ["2017-09", "2017-09"],
    ["2017-09-04", "2017-09-04"],
    ["Sept 2017", "2017-09"],
    ["Sept. 2017", "2017-09"],
    ["September 2017", "2017-09"],
    ["sep 2017", "2017-09"],
    ["Jan 2020", "2020-01"],
    ["May 2021", "2021-05"],
    ["09/2017", "2017-09"],
    ["9/2017", "2017-09"],
    ["09-2017", "2017-09"],
    ["2017/09", "2017-09"],
    ["  2017  ", "2017"],
    ["septiembre 2017", "2017-09"],
    ["ene 2020", "2020-01"]
  ])("reads %s as %s", (raw, expected) => {
    expect(normalizeResumeDate(raw)).toBe(expected)
  })

  it.each(["", "Present", "2018 - 2020 (contract)", "summer", "20177"])(
    "cannot read %s",
    (raw) => {
      expect(normalizeResumeDate(raw)).toBeNull()
    }
  )
})

describe("isCurrentTerm", () => {
  it.each(["Present", "present", " Current ", "now", "Actual", "Actualidad"])(
    "reads %s as still here",
    (raw) => {
      expect(isCurrentTerm(raw)).toBe(true)
    }
  )

  it.each(["2017-09", "Sept 2017", "", "presently employed"])(
    "does not read %s as still here",
    (raw) => {
      expect(isCurrentTerm(raw)).toBe(false)
    }
  )
})

describe("formatResumeDate", () => {
  it("prints each precision at the precision it was stored with", () => {
    expect(formatResumeDate("2017", "en")).toBe("2017")
    expect(formatResumeDate("2017-09", "en")).toBe("Sep 2017")
    expect(formatResumeDate("2017-09-04", "en")).toBe("Sep 4, 2017")
  })

  it("writes the month in the document's own language", () => {
    expect(formatResumeDate("2017-09", "es")).toMatch(/sept/i)
  })

  /*
    The migration leaves a date it could not read exactly as the user typed it
    (#71), so the formatter is the last thing standing between that value and a
    resume that suddenly renders a blank where a date used to be.
  */
  it("prints a value it does not recognise verbatim", () => {
    expect(formatResumeDate("2018 - 2020 (contract)", "en")).toBe(
      "2018 - 2020 (contract)"
    )
  })

  it("prints nothing for an empty date", () => {
    expect(formatResumeDate("", "en")).toBe("")
  })
})

describe("formatResumeDateRange", () => {
  it("joins the two ends", () => {
    expect(
      formatResumeDateRange(
        { startDate: "2017-09", endDate: "2021-05", current: false },
        "en"
      )
    ).toEqual({ start: "Sep 2017", end: "May 2021" })
  })

  it("renders the trailing term from the flag, not from the column", () => {
    expect(
      formatResumeDateRange(
        { startDate: "2017-09", endDate: "", current: true },
        "en"
      )
    ).toEqual({ start: "Sep 2017", end: "Present" })
  })

  it("says it in the document's language", () => {
    expect(
      formatResumeDateRange(
        { startDate: "2017-09", endDate: "", current: true },
        "es"
      ).end
    ).toBe("Actualidad")
  })

  /*
    `current` wins over whatever the column holds: the two disagreeing is the
    exact state the checkbox exists to make unrepresentable, and the flag is
    the half of it the user set on purpose.
  */
  it("ignores an end date left behind under a set flag", () => {
    expect(
      formatResumeDateRange(
        { startDate: "2017-09", endDate: "2021-05", current: true },
        "en"
      ).end
    ).toBe("Present")
  })
})

/**
 * What a model hands back. Both the generation and the PDF import read a
 * document rather than author one, so what arrives is whatever the resume said
 * — `Sept 2017`, `Present`, and occasionally something no one can read.
 */
describe("normalizeEntryDates", () => {
  it("reads a pair of written dates into the subset", () => {
    expect(
      normalizeEntryDates({ startDate: "Sept 2017", endDate: "May 2021" })
    ).toEqual({ startDate: "2017-09", endDate: "2021-05", current: false })
  })

  it("moves the model's word for a current role into the flag", () => {
    expect(
      normalizeEntryDates({ startDate: "Jan 2020", endDate: "Present" })
    ).toEqual({ startDate: "2020-01", endDate: "", current: true })
  })

  it("empties an end date the model left behind under its own flag", () => {
    expect(
      normalizeEntryDates({
        startDate: "2020-01",
        endDate: "2021-05",
        current: true
      })
    ).toEqual({ startDate: "2020-01", endDate: "", current: true })
  })

  /*
    The same policy the migration took: a date nobody can read is kept, not
    blanked. The user reviews every imported step, and a field holding what
    their resume said is one they can correct — where an empty one is a date
    they have to remember.
  */
  it("keeps a date it cannot read rather than dropping it", () => {
    expect(
      normalizeEntryDates({
        startDate: "2018 - 2020 (contract)",
        endDate: "2021"
      })
    ).toEqual({
      startDate: "2018 - 2020 (contract)",
      endDate: "2021",
      current: false
    })
  })

  it("leaves an end date the resume simply did not give empty", () => {
    expect(normalizeEntryDates({ startDate: "2020-01", endDate: "" })).toEqual({
      startDate: "2020-01",
      endDate: "",
      current: false
    })
  })
})

/**
 * The two questions the typed date exists to make answerable (#71): what order
 * entries go in, and how long the hole between two of them is. Nothing consumes
 * either yet — scoring will — but a column shape that cannot answer them is the
 * shape this change was made to replace, so they are asserted here.
 */
describe("compareResumeDates", () => {
  it("orders dates earliest first", () => {
    expect(compareResumeDates("2017-09", "2021-05")).toBeLessThan(0)
    expect(compareResumeDates("2021-05", "2017-09")).toBeGreaterThan(0)
    expect(compareResumeDates("2017-09", "2017-09")).toBe(0)
  })

  it("compares across precisions", () => {
    expect(compareResumeDates("2017", "2017-09")).toBeLessThan(0)
    expect(compareResumeDates("2017-09-04", "2017-09-05")).toBeLessThan(0)
    expect(compareResumeDates("2016", "2017-01")).toBeLessThan(0)
  })

  /*
    A date nobody can read cannot be placed on the timeline, and guessing where
    it goes would be worse than admitting it. It sorts last, so a legacy value
    never displaces an entry whose date is known.
  */
  it("sorts a date it cannot read last, in either position", () => {
    expect(compareResumeDates("nonsense", "2017")).toBeGreaterThan(0)
    expect(compareResumeDates("2017", "nonsense")).toBeLessThan(0)
    expect(compareResumeDates("nonsense", "also nonsense")).toBe(0)
  })
})

describe("compareByStartDate", () => {
  const entry = (startDate: string) => ({ startDate })

  it("puts the most recent entry first, the way a resume reads", () => {
    const entries = [entry("2015-01"), entry("2021-05"), entry("2017-09")]

    expect(entries.sort(compareByStartDate).map((e) => e.startDate)).toEqual([
      "2021-05",
      "2017-09",
      "2015-01"
    ])
  })
})

describe("monthsBetween", () => {
  it("counts whole months from one date to another", () => {
    expect(monthsBetween("2017-01", "2017-07")).toBe(6)
    expect(monthsBetween("2017-01", "2018-01")).toBe(12)
    expect(monthsBetween("2017-09", "2017-09")).toBe(0)
  })

  /*
    The gap a 6-month knockout rule asks about: a job that ended in March and a
    job that started in December is a nine-month hole.
  */
  it("measures the gap between one entry's end and the next one's start", () => {
    expect(monthsBetween("2020-03", "2020-12")).toBe(9)
  })

  it("counts backwards as a negative number rather than an error", () => {
    expect(monthsBetween("2020-12", "2020-03")).toBe(-9)
  })

  it("reads a year-only date as that year's January", () => {
    expect(monthsBetween("2020", "2020-06")).toBe(5)
    expect(monthsBetween("2020", "2021")).toBe(12)
  })

  it("cannot measure against a date it cannot read", () => {
    expect(monthsBetween("summer", "2020-06")).toBeNull()
    expect(monthsBetween("2020-06", "")).toBeNull()
  })
})

/**
 * What a *column* will take, as opposed to what a completed form will. Empty is
 * writable — the editor inserts blank rows and a current entry has no end date
 * — where "is this entry finished?" is a question the insert schemas ask.
 */
describe("isWritableEntryDate", () => {
  it.each(["", "2017", "2017-09", "2017-09-04"])("accepts %s", (value) => {
    expect(isWritableEntryDate(value)).toBe(true)
  })

  it.each(["Sept 2017", "Present", "2017-13", "20"])(
    "refuses %s",
    (value) => {
      expect(isWritableEntryDate(value)).toBe(false)
    }
  )
})
