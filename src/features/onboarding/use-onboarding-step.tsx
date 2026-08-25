"use client"

import { createContext, useContext } from "react"

/** In step order. `OnboardingTabs` owns which one is showing. */
export const onboardingSteps = [
  { id: "import", label: "Import" },
  { id: "contact", label: "Contact" },
  { id: "education", label: "Education" },
  { id: "experience", label: "Work Experience" },
  { id: "skills", label: "Skills" }
] as const

export type OnboardingStepId = (typeof onboardingSteps)[number]["id"]

const OnboardingStepContext = createContext<{
  activeStep: OnboardingStepId
  goToStep: (step: OnboardingStepId) => void
} | null>(null)

export function OnboardingStepProvider({
  activeStep,
  goToStep,
  children
}: {
  activeStep: OnboardingStepId
  goToStep: (step: OnboardingStepId) => void
  children: React.ReactNode
}) {
  return (
    <OnboardingStepContext.Provider value={{ activeStep, goToStep }}>
      {children}
    </OnboardingStepContext.Provider>
  )
}

/**
 * Moving between steps is a state change, not a navigation. Steps call
 * `goToStep` where they used to call `router.push("/onboarding/...")`.
 */
export function useOnboardingStep() {
  const context = useContext(OnboardingStepContext)

  if (!context) {
    throw new Error("useOnboardingStep must be used inside OnboardingTabs")
  }

  return context
}
