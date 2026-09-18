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
  deriveOnboardingSteps,
  onboardingPanelKey
} from "~/features/onboarding/onboarding-steps"
import {
  OnboardingStepProvider,
  stepHeadingId,
  useOnboardingStep
} from "~/features/onboarding/use-onboarding-step"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

/**
 * Onboarding is one route: a fork, and then a trail of steps behind whichever
 * way it is taken — one per the account's own sections, contact leading. The
 * trail sits in the app header, so where the user is has to be state above the
 * page — the provider owns it, and the header and the panel both read it.
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
  const { id: userId } = useUser()

  // The trail is derived from the profile's own sections rather than a fixed
  // tuple, so it draws nothing beyond contact until the profile it is drawn
  // from has loaded.
  const { data: profile } = api.profile.read.useQuery(undefined, {
    enabled: !!userId
  })

  const steps = deriveOnboardingSteps(profile ?? { sections: [] })

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
  // A trail behind it would promise the same steps whichever is taken.
  if (!activeStep) return null

  /*
    A trail rather than tabs: the steps are one ordered path through the
    profile, and the crumb you are on is the one page of it that is open. Every
    other crumb stays clickable — the order is a suggestion, not a lock.
  */
  return (
    <Breadcrumb className="flex min-w-0 flex-1 justify-center">
      <BreadcrumbList className="flex-nowrap overflow-x-auto whitespace-nowrap py-2 max-md:justify-start">
        {steps.map((step, index) => {
          // Contact is the one step that is not a section: its label is
          // copy. Every other crumb is labelled with the heading stored on
          // the section itself, in whatever language the account wrote it.
          const label = step.label ?? t("contact")

          // A step's own id only names the same core section by coincidence:
          // it is stood in with its kind as its id until the account holds a
          // row of its own, and gets a real one the moment it does. The
          // panel key is what stays stable across that — see
          // `onboardingPanelKey`.
          const panelKey = onboardingPanelKey(step)

          return (
            <Fragment key={step.id}>
              {index > 0 && <BreadcrumbSeparator />}

              <BreadcrumbItem>
                {panelKey === activeStep ? (
                  <BreadcrumbPage
                    ref={activeStepRef}
                    id={stepHeadingId(panelKey)}
                  >
                    {label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <button
                      type="button"
                      id={stepHeadingId(panelKey)}
                      onClick={() => goToStep(panelKey)}
                      className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {label}
                    </button>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
