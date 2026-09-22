"use client"

import { ContactStep } from "~/features/onboarding/contact-step"
import { CustomSectionStep } from "~/features/onboarding/custom-section-step"
import { EducationStep } from "~/features/onboarding/education-step"
import { ExperienceStep } from "~/features/onboarding/experience-step"
import { OnboardingFork } from "~/features/onboarding/onboarding-fork"
import { OnboardingSectionChrome } from "~/features/onboarding/onboarding-section-chrome"
import { SkillsStep } from "~/features/onboarding/skills-step"
import {
  type OnboardingStepId,
  panelHeadingId,
  useOnboardingStep
} from "~/features/onboarding/use-onboarding-step"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

/**
 * Only the open step is mounted, so each one still loads its profile data and
 * resets its form the way it did when it was a page of its own.
 *
 * This is also where the reading column is set. The steps below it lay out
 * fields and nothing else — none of them decides how wide the page is.
 */
export function OnboardingPanels() {
  const { activeStep } = useOnboardingStep()

  return (
    <div
      role="region"
      aria-labelledby={panelHeadingId(activeStep)}
      className="m-auto w-full max-w-3xl py-12 max-sm:py-8"
    >
      <ActivePanel activeStep={activeStep} />
    </div>
  )
}

/**
 * The three kinds onboarding still has a form of its own for — every one of
 * them wears the same chrome a custom section does, rename, move and remove
 * included. `onboardingPanelKey` is what keys a step by kind rather than by
 * row id for exactly these three, so `activeStep` here already agrees with
 * `section.kind`.
 */
const dedicatedFormKinds = ["education", "experience", "skills"] as const

function ActivePanel({ activeStep }: { activeStep: OnboardingStepId | null }) {
  const { id: userId } = useUser()

  const { data: profile } = api.profile.read.useQuery(undefined, {
    enabled: !!userId
  })

  if (!activeStep) return <OnboardingFork />
  if (activeStep === "contact") return <ContactStep />

  if ((dedicatedFormKinds as readonly string[]).includes(activeStep)) {
    const section = profile?.sections.find((row) => row.kind === activeStep)

    // The account has not loaded yet — every kind here is in the required
    // set, so a section always exists once it has.
    if (!section) return null

    return (
      <OnboardingSectionChrome panelKey={activeStep} sectionId={section.id}>
        {activeStep === "education" && <EducationStep />}
        {activeStep === "experience" && <ExperienceStep />}
        {activeStep === "skills" && <SkillsStep />}
      </OnboardingSectionChrome>
    )
  }

  // Anything else is a section found by import with no dedicated form: its id
  // is its own panel key, so `activeStep` already names it.
  return <CustomSectionStep sectionId={activeStep} />
}
