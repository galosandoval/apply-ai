import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The English fallback, exercised rather than reasoned about.
 *
 * `check:messages` keeps `es.json` complete, so the interesting case — a
 * Spanish resume whose heading has no Spanish message yet — cannot be produced
 * from the real files. The Spanish tree is stubbed instead: what is under test
 * is the resolution order, not the state of the message files, and a heading
 * this resolves to a raw `sectionLabels.skills` is one that goes out on a
 * document somebody sends to an employer.
 */

const importLabels = () => import("./section-labels")

beforeEach(() => {
  vi.resetModules()
  vi.doUnmock("../../../../messages/es.json")
})

describe("sectionLabelerFor", () => {
  it("writes the heading in the resume's own language", async () => {
    const { sectionLabelerFor, sectionLabelPath } = await importLabels()
    const label = await sectionLabelerFor("es")

    expect(label(sectionLabelPath("skills"), "Skills")).toBe("Habilidades")
  })

  it("falls back to English for a key the language has not translated", async () => {
    vi.doMock("../../../../messages/es.json", () => ({
      // Spanish as it would be mid-translation: the namespace exists, the
      // heading under test does not.
      default: { sectionLabels: { experience: "Experiencia" } }
    }))

    const { sectionLabelerFor, sectionLabelPath } = await importLabels()
    const label = await sectionLabelerFor("es")

    expect(label(sectionLabelPath("experience"), "Experience")).toBe(
      "Experiencia"
    )
    // English, not `sectionLabels.skills` and not the caller's own guess.
    expect(label(sectionLabelPath("skills"), "Fallback")).toBe("Skills")
  })

  it("keeps the caller's own label for a path neither language has", async () => {
    const { presetLabelPath, sectionLabelerFor } = await importLabels()
    const label = await sectionLabelerFor("es")

    expect(label(presetLabelPath("not-a-preset"), "Whatever it displayed")).toBe(
      "Whatever it displayed"
    )
  })
})
