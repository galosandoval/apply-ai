"use client"

import { useTranslations } from "next-intl"
import { Fragment, useEffect, useRef } from "react"
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
  useOnboardingStep
} from "~/features/onboarding/use-onboarding-step"

/**
 * Onboarding is one route: a fork, and then four steps behind whichever way it
 * is taken. The trail sits in the app header, so where the user is has to be
 * state above the page — the provider owns it, and the header and the panel
 * both read it.
 */
export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingStepProvider>
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
    once the window is too narrow to hold all of them — so the step you just
    moved to can land off-screen with nothing to say it changed.
  */
  useEffect(() => {
    activeStepRef.current?.scrollIntoView({
      block: "nearest",
      inline: "center"
    })
  }, [activeStep])

  // The fork is a choice between two routes, not a place on either of them.
  // A trail behind it would promise the same four steps whichever is taken.
  if (!activeStep) return null

  /*
    A trail rather than tabs: the steps are one ordered path through the
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
