"use client"

import { useEffect, useRef, useState } from "react"
import { ProtectedNavbar } from "~/components/navbar/protected-navbar"
import { cn } from "~/lib/utils"
import {
  OnboardingStepProvider,
  onboardingSteps,
  useOnboardingStep,
  type OnboardingStepId
} from "~/features/onboarding/use-onboarding-step"

/**
 * Onboarding is one route with five tabs, and the tabs sit in the app header —
 * so which step is open has to be state above the page, not inside it. This
 * shell owns it and hands it to the header and the panel alike.
 */
export function OnboardingShell({ children }: { children: React.ReactNode }) {
  const [activeStep, setActiveStep] = useState<OnboardingStepId>("import")

  return (
    <OnboardingStepProvider activeStep={activeStep} goToStep={setActiveStep}>
      <ProtectedNavbar>
        <OnboardingTabs />
      </ProtectedNavbar>

      {/*
        The scroll lives here, not on the body: the navbar is a flex sibling
        above, so this takes the height that is left. Centering is the panel's
        `m-auto` rather than `place-items-center` — auto margins collapse to
        zero once the form is taller than the viewport, where centering would
        push its first fields above the scroll origin and out of reach.
      */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
        {children}
      </main>
    </OnboardingStepProvider>
  )
}

function OnboardingTabs() {
  const { activeStep, goToStep } = useOnboardingStep()
  const activeTabRef = useRef<HTMLButtonElement>(null)

  /*
    Steps advance on submit as well as on click, and the strip scrolls sideways
    once the window is too narrow to hold all five — so the step you just moved
    to can land off-screen with nothing to say it changed.
  */
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [activeStep])

  return (
    <div
      role="tablist"
      aria-label="Onboarding steps"
      className="flex flex-1 justify-center gap-1 overflow-x-auto max-md:justify-start"
    >
      {onboardingSteps.map((step) => (
        <button
          key={step.id}
          ref={step.id === activeStep ? activeTabRef : null}
          role="tab"
          type="button"
          id={`onboarding-tab-${step.id}`}
          aria-selected={step.id === activeStep}
          aria-controls={`onboarding-panel-${step.id}`}
          onClick={() => goToStep(step.id)}
          className={cn(
            "min-h-11 whitespace-nowrap border-b-2 border-transparent px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            step.id === activeStep && "border-primary text-foreground"
          )}
        >
          {step.label}
        </button>
      ))}
    </div>
  )
}
