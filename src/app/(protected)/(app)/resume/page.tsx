import { type Metadata } from "next"
import { ResumeListView } from "~/features/resume/resume-list-view"

export const metadata: Metadata = { title: "Your resumes" }

export default function Page() {
  return <ResumeListView />
}
