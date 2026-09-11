import { describe, expect, it } from "vitest"
import {
  forkRoute,
  onboardingSteps,
  stepRoute
} from "~/features/onboarding/use-onboarding-step"

describe("onboarding routes", () => {
  it("opens on the fork, with no step and nothing to explain", () => {
    expect(forkRoute).toEqual({ activeStep: null, importNotice: "" })
  })

  it("leaves the import out of the trail", () => {
    expect(onboardingSteps).toEqual([
      "contact",
      "education",
      "experience",
      "skills"
    ])
  })

  it("carries the import's explanation into the forms", () => {
    expect(stepRoute("contact", "No text in that PDF.")).toEqual({
      activeStep: "contact",
      importNotice: "No text in that PDF."
    })
  })

  it("drops the explanation once the user moves on", () => {
    expect(stepRoute("education")).toEqual({
      activeStep: "education",
      importNotice: ""
    })
  })
})
