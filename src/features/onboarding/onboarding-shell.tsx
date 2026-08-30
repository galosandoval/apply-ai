"use client"

import { useTranslations } from "next-intl"
import { Fragment, useEffect, useRef, useState } from "react"
import { ProtectedNavbar } from "~/components/navbar/protected-navbar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "~/components/ui/breadcrumb"
import {
  OnboardingStepProvider,
  onboardingSteps,
  useOnboardingStep,
  type OnboardingStepId
} from "~/features/onboarding/use-onboarding-step"

/**
 * Onboarding is one route with five steps, and the trail sits in the app header —
 * so which step is open has to be state above the page, not inside it. This
 * shell owns it and hands it to the header and the panel alike.
 */
export function OnboardingShell({ children }: { children: React.ReactNode }) {
  const [activeStep, setActiveStep] = useState<OnboardingStepId>("import")

  return (
    <OnboardingStepProvider activeStep={activeStep} goToStep={setActiveStep}>
      <ProtectedNavbar>
        <OnboardingBreadcrumbs />
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

function OnboardingBreadcrumbs() {
  const t = useTranslations("onboarding.steps")
  const { activeStep, goToStep } = useOnboardingStep()
  const activeStepRef = useRef<HTMLSpanElement>(null)

  /*
    Steps advance on submit as well as on click, and the trail scrolls sideways
    once the window is too narrow to hold all five — so the step you just moved
    to can land off-screen with nothing to say it changed.
  */
  useEffect(() => {
    activeStepRef.current?.scrollIntoView({
      block: "nearest",
      inline: "center"
    })
  }, [activeStep])

  /*
    A trail rather than tabs: the five steps are one ordered path through the
    profile, and the crumb you are on is the one page of it that is open. Every
    other crumb stays clickable — the order is a suggestion, not a lock.
  */
  return (
    <Breadcrumb className="flex min-w-0 flex-1 justify-center">
      <BreadcrumbList className="flex-nowrap overflow-x-auto whitespace-nowrap py-2 max-md:justify-start">
        {onboardingSteps.map((step, index) => (
          <Fragment key={step}>
            {index > 0 && <BreadcrumbSeparator />}

            <BreadcrumbItem>
              {step === activeStep ? (
                <BreadcrumbPage
                  ref={activeStepRef}
                  id={`onboarding-step-${step}`}
                >
                  {t(step)}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <button
                    type="button"
                    id={`onboarding-step-${step}`}
                    onClick={() => goToStep(step)}
                    className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {t(step)}
                  </button>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
