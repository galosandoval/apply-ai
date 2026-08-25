"use client"

import { ContactStep } from "~/features/onboarding/contact-step"
import { EducationStep } from "~/features/onboarding/education-step"
import { ExperienceStep } from "~/features/onboarding/experience-step"
import { ImportStep } from "~/features/onboarding/import-step"
import { SkillsStep } from "~/features/onboarding/skills-step"
import { useOnboardingStep } from "~/features/onboarding/use-onboarding-step"

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
      aria-labelledby={`onboarding-step-${activeStep}`}
      className="m-auto w-full max-w-3xl py-12 max-sm:py-8"
    >
      <ActivePanel />
    </div>
  )
}

function ActivePanel() {
  const { activeStep } = useOnboardingStep()

  if (activeStep === "import") return <ImportStep />
  if (activeStep === "contact") return <ContactStep />
  if (activeStep === "education") return <EducationStep />
  if (activeStep === "experience") return <ExperienceStep />

  return <SkillsStep />
}
