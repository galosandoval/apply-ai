import { type Metadata } from "next"
import { OnboardingPanels } from "~/features/onboarding/onboarding-panels"

export const metadata: Metadata = { title: "Set up your profile" }

export default function Page() {
  return <OnboardingPanels />
}
