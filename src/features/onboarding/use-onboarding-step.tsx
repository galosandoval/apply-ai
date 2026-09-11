"use client"

import { createContext, useContext, useState } from "react"

/**
 * The forms, in order. Onboarding's entry is the fork, not a step — importing a
 * resume is one of the two ways in, so it is not a crumb on the trail either
 * route ends up walking.
 *
 * Ids only — the crumb labels are copy, and live under `onboarding.steps` in
 * the message files so the trail reads in the user's language.
 */
export const onboardingSteps = [
  "contact",
  "education",
  "experience",
  "skills"
] as const

export type OnboardingStepId = (typeof onboardingSteps)[number]

/**
 * Where onboarding is. `activeStep` is null on the fork, which wears no trail:
 * until a route is chosen there is no path behind the user to draw.
 */
export type OnboardingRoute = {
  activeStep: OnboardingStepId | null
  /** What the import said on its way out, when the forms caught it. */
  importNotice: string
}

/** The entry screen: two routes offered, neither taken. */
export const forkRoute: OnboardingRoute = { activeStep: null, importNotice: "" }

/**
 * The route for an open step. `importNotice` is only worth passing on the way
 * to the forms from a failed import — moving on clears it.
 */
export function stepRoute(
  activeStep: OnboardingStepId,
  importNotice = ""
): OnboardingRoute {
  return { activeStep, importNotice }
}

const OnboardingStepContext = createContext<
  | (OnboardingRoute & {
      goToStep: (step: OnboardingStepId, importNotice?: string) => void
    })
  | null
>(null)

/**
 * Owns which step is open, so the header trail and the page's panel read the
 * same one. Both sit under it, and neither can be the owner.
 */
export function OnboardingStepProvider({
  children
}: {
  children: React.ReactNode
}) {
  const [route, setRoute] = useState(forkRoute)

  const goToStep = (step: OnboardingStepId, importNotice?: string) => {
    setRoute(stepRoute(step, importNotice))
  }

  return (
    <OnboardingStepContext.Provider value={{ ...route, goToStep }}>
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
