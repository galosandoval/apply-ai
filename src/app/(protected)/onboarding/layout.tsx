import { OnboardingShell } from "~/features/onboarding/onboarding-shell"

/**
 * Onboarding trades the app navigation for its step tabs. The shell is a client
 * component because the open step is state, and both the header tabs and the
 * page's panel read it.
 */
export default function OnboardingLayout({
  children
}: {
  children: React.ReactNode
}) {
  return <OnboardingShell>{children}</OnboardingShell>
}
