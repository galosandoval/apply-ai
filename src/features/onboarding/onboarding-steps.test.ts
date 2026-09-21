import { describe, expect, it } from "vitest"
import {
  deriveOnboardingSteps,
  nextOnboardingStep,
  onboardingPanelKey,
  type OnboardingProfile
} from "~/features/onboarding/onboarding-steps"

const contactStep = { id: "contact", kind: null, label: null }

describe("deriveOnboardingSteps", () => {
  it("leads with contact, ahead of every section", () => {
    const profile: OnboardingProfile = {
      sections: [{ id: "skills", kind: "skills", label: "Skills" }]
    }

    expect(deriveOnboardingSteps(profile)[0]).toEqual(contactStep)
  })

  it("yields the required set for a profile with none of its own sections", () => {
    const profile: OnboardingProfile = {
      sections: [
        { id: "skills", kind: "skills", label: "Skills" },
        { id: "experience", kind: "experience", label: "Experience" },
        { id: "education", kind: "education", label: "Education" }
      ]
    }

    expect(deriveOnboardingSteps(profile)).toEqual([
      contactStep,
      { id: "skills", kind: "skills", label: "Skills" },
      { id: "experience", kind: "experience", label: "Experience" },
      { id: "education", kind: "education", label: "Education" }
    ])
  })

  it("yields a step per imported section, in the document's order and under its own headings", () => {
    const profile: OnboardingProfile = {
      sections: [
        { id: "s-skills", kind: "skills", label: "Skills" },
        { id: "s-experience", kind: "experience", label: "Experience" },
        { id: "s-education", kind: "education", label: "Education" },
        { id: "s-projects", kind: "custom", label: "Projects" },
        { id: "s-certs", kind: "custom", label: "Certifications" }
      ]
    }

    expect(deriveOnboardingSteps(profile)).toEqual([
      contactStep,
      { id: "s-skills", kind: "skills", label: "Skills" },
      { id: "s-experience", kind: "experience", label: "Experience" },
      { id: "s-education", kind: "education", label: "Education" },
      { id: "s-projects", kind: "custom", label: "Projects" },
      { id: "s-certs", kind: "custom", label: "Certifications" }
    ])
  })

  it("yields just contact for a profile with no sections at all", () => {
    expect(deriveOnboardingSteps({ sections: [] })).toEqual([contactStep])
  })
})

describe("onboardingPanelKey", () => {
  it("keys contact by its own id", () => {
    expect(onboardingPanelKey(contactStep)).toBe("contact")
  })

  it("keys a section with a dedicated form by its kind, not its stored id", () => {
    expect(
      onboardingPanelKey({ id: "cuid-1", kind: "education", label: "Education" })
    ).toBe("education")
    expect(
      onboardingPanelKey({ id: "cuid-2", kind: "experience", label: "Experience" })
    ).toBe("experience")
    expect(
      onboardingPanelKey({ id: "cuid-3", kind: "skills", label: "Skills" })
    ).toBe("skills")
  })

  it("keys a section with no dedicated form by its own id", () => {
    expect(
      onboardingPanelKey({ id: "cuid-4", kind: "custom", label: "Projects" })
    ).toBe("cuid-4")
  })
})

describe("nextOnboardingStep", () => {
  const profile: OnboardingProfile = {
    sections: [
      { id: "s-skills", kind: "skills", label: "Skills" },
      { id: "s-experience", kind: "experience", label: "Experience" },
      { id: "s-projects", kind: "custom", label: "Projects" }
    ]
  }

  it("advances from contact to the first section", () => {
    expect(nextOnboardingStep(profile, "contact")).toBe("skills")
  })

  it("advances from one section to the next, keyed by panel key", () => {
    expect(nextOnboardingStep(profile, "skills")).toBe("experience")
    expect(nextOnboardingStep(profile, "experience")).toBe("s-projects")
  })

  it("returns null past the last step", () => {
    expect(nextOnboardingStep(profile, "s-projects")).toBeNull()
  })

  it("returns null for a step not on the trail", () => {
    expect(nextOnboardingStep(profile, "education")).toBeNull()
  })

  it("advances from contact straight past the end for a profile with no sections", () => {
    expect(nextOnboardingStep({ sections: [] }, "contact")).toBeNull()
  })
})
