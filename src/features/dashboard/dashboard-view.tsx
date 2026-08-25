"use client"

import { GenerateResumeForm } from "~/features/dashboard/generate-resume-form"

export function DashboardView() {
  return (
    <main className="top-0 my-auto h-full overflow-y-auto md:grid md:place-items-center">
      <GenerateResumeForm />
    </main>
  )
}
