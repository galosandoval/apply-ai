import { type Metadata } from "next"
import { SkillsStep } from "~/features/onboarding/skills-step"

export const metadata: Metadata = { title: "Skills" }

export default function Page() {
  return <SkillsStep />
}
