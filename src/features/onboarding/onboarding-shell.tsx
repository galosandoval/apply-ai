"use client"

import { useState } from "react"
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

      <main className="h-full overflow-y-auto px-4 md:grid md:place-items-center">
        {children}
      </main>
    </OnboardingStepProvider>
  )
}

function OnboardingTabs() {
  const { activeStep, goToStep } = useOnboardingStep()

  return (
    <div
      role="tablist"
      aria-label="Onboarding steps"
      className="flex flex-1 justify-start gap-1 overflow-x-auto md:justify-center"
    >
      {onboardingSteps.map((step) => (
        <button
          key={step.id}
          role="tab"
          type="button"
          id={`onboarding-tab-${step.id}`}
          aria-selected={step.id === activeStep}
          aria-controls={`onboarding-panel-${step.id}`}
          onClick={() => goToStep(step.id)}
          className={cn(
            "min-h-11 whitespace-nowrap border-b-2 border-transparent px-3 text-sm text-muted-foreground",
            step.id === activeStep && "border-primary text-foreground"
          )}
        >
          {step.label}
        </button>
      ))}
    </div>
  )
}
