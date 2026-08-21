"use client"

import Link from "next/link"
import { appPath } from "~/lib/path"
import { api } from "~/utils/api"

export function ResumeListView() {
  const { data: resumes, status } = api.resume.list.useQuery()

  if (status === "error" || !resumes) return <div>{status}</div>

  if (status === "success") {
    return (
      <div className="grid gap-2 p-4 md:grid-cols-2 lg:grid-cols-4">
        {resumes.map((resume) => (
          <Link
            className="rounded-md border border-neutral-200 p-3"
            href={appPath.resumeById(resume.id)}
            key={resume.id}
          >
            <h2 className="font-semibold">{resume.profession}</h2>

            {/*
              The posting is what tells one resume from another — a list of
              dates is a list of dates. Two lines of it is enough to recognize.
            */}
            <p className="line-clamp-2 text-sm text-neutral-600">
              {resume.jobDescription || "No job description saved"}
            </p>

            <p className="pt-1 text-xs text-neutral-500">
              {resume.createdAt.toDateString()}
            </p>
          </Link>
        ))}
      </div>
    )
  }

  return <main className="grid h-full place-items-center">Loading...</main>
}