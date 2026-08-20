import { type Metadata } from "next"
import { ContactStep } from "~/features/onboarding/contact-step"

export const metadata: Metadata = { title: "Contact details" }

export default function Page() {
  return <ContactStep />
}
