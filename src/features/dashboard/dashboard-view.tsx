"use client"

import { GenerateResumeForm } from "~/features/dashboard/generate-resume-form"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

export function DashboardView() {
  const { id } = useUser()

  const { data, status } = api.profile.read.useQuery(undefined, { enabled: !!id })

  if (status !== "success") {
    return (
      <main className="my-auto h-full overflow-y-auto md:grid md:place-items-center">
        loading...
      </main>
    )
  }

  return (
    <main className="top-0 my-auto h-full overflow-y-auto md:grid md:place-items-center">
      <GenerateResumeForm profile={data} />
    </main>
  )
}