"use client"

import { createContext, useContext } from "react"

/**
 * In step order. `OnboardingShell` owns which one is showing.
 *
 * Ids only — the crumb labels are copy, and live under `onboarding.steps` in
 * the message files so the trail reads in the user's language.
 */
export const onboardingSteps = [
  "import",
  "contact",
  "education",
  "experience",
  "skills"
] as const

export type OnboardingStepId = (typeof onboardingSteps)[number]

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
    throw new Error("useOnboardingStep must be used inside OnboardingShell")
  }

  return context
}
