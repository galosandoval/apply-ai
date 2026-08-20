import { ProtectedNavbar } from "~/components/navbar/protected-navbar"
import { OnboardingBreadcrumbs } from "~/components/navbar/onboarding-breadcrumbs"

/**
 * Onboarding trades the app navigation for step breadcrumbs. That used to be a
 * `pathname.includes("onboarding")` branch inside the navbar; here it is just
 * the layout the onboarding segment happens to have.
 */
export default function OnboardingLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ProtectedNavbar>
        <OnboardingBreadcrumbs />
      </ProtectedNavbar>

      <main className="h-full overflow-y-auto md:grid md:place-items-center">
        {children}
      </main>
    </>
  )
}
