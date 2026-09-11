import { describe, expect, it } from "vitest"
import {
  forkHeadingId,
  forkRoute,
  onboardingSteps,
  panelHeadingId,
  stepHeadingId
} from "~/features/onboarding/use-onboarding-step"

describe("onboarding routes", () => {
  it("opens on the fork, with no step and nothing to explain", () => {
    expect(forkRoute).toEqual({ activeStep: null, importNotice: null })
  })

  it("leaves the import out of the trail", () => {
    expect(onboardingSteps).toEqual([
      "contact",
      "education",
      "experience",
      "skills"
    ])
  })
})

describe("panelHeadingId", () => {
  it("labels the panel by the fork's own heading while the fork is open", () => {
    expect(panelHeadingId(null)).toBe(forkHeadingId)
  })

  it("labels it by the open step's crumb once a route is chosen", () => {
    for (const step of onboardingSteps) {
      expect(panelHeadingId(step)).toBe(stepHeadingId(step))
    }
  })
})
