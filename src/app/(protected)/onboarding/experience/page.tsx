import { type Metadata } from "next"
import { ExperienceStep } from "~/features/onboarding/experience-step"

export const metadata: Metadata = { title: "Experience" }

export default function Page() {
  return <ExperienceStep />
}
