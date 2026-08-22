import { type Metadata } from "next"
import { EducationStep } from "~/features/onboarding/education-step"

export const metadata: Metadata = { title: "Education" }

export default function Page() {
  return <EducationStep />
}
