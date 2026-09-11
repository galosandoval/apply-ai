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
  /**
   * What the import said on its way out, when the forms caught it. `null` when
   * the user came to a step under their own steam — there is nothing to
   * explain, which is a different thing from an explanation that says nothing.
   */
  importNotice: string | null
}

/** The entry screen: two routes offered, neither taken. */
export const forkRoute: OnboardingRoute = {
  activeStep: null,
  importNotice: null
}

/**
 * What labels the open panel, in one place: the trail writes these ids onto its
 * crumbs and the fork onto its heading, and the panel points `aria-labelledby`
 * at whichever is showing. Two rules for this is how the panel ends up
 * labelled by an element that isn't on the page.
 */
export const forkHeadingId = "onboarding-fork-title"

export const stepHeadingId = (step: OnboardingStepId) =>
  `onboarding-step-${step}`

export const panelHeadingId = (activeStep: OnboardingStepId | null) =>
  activeStep ? stepHeadingId(activeStep) : forkHeadingId

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

  /**
   * `importNotice` is only worth passing on the way to the forms from a failed
   * import — moving on clears it.
   */
  const goToStep = (step: OnboardingStepId, importNotice?: string) => {
    setRoute({ activeStep: step, importNotice: importNotice ?? null })
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
