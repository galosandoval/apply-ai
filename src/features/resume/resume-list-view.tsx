"use client"

import Link from "next/link"
import { appPath } from "~/lib/path"
import { api } from "~/utils/api"

export function ResumeListView() {
  const { data: resumes, status } = api.resume.list.useQuery()

  if (status === "error" || !resumes) return <div>{status}</div>

  if (status === "success") {
    return (
      <>
        <div className="grid grid-cols-4">
          {resumes.map((resume) => (
            <Link href={appPath.resumeById(resume.id)} key={resume.id}>
              <h1>{resume.createdAt.toDateString()}</h1>
            </Link>
          ))}
        </div>
      </>
    )
  }

  return <main className="grid h-full place-items-center">Loading...</main>
}