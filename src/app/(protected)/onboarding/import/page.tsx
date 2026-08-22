import { type Metadata } from "next"
import { ImportStep } from "~/features/onboarding/import-step"

export const metadata: Metadata = { title: "Import a resume" }

export default function Page() {
  return <ImportStep />
}
