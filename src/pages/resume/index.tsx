import Link from "next/link"
import { AppHead } from "~/components/app-head"
import { appPath } from "~/lib/path"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

const useResumes = () => {
  const { id } = useUser()
  const { data: profile } = api.profile.read.useQuery(
    { userId: id },
    {
      enabled: !!id
    }
  )

  const { data: resumes, status } = api.resume.list.useQuery(
    { profileId: profile?.id ?? "" },
    { enabled: !!profile?.id }
  )
  return { resumes, status }
}

export default function ResumesView() {
  const { resumes, status } = useResumes()

  if (status === "error" || !resumes)
    return (
      <div>
        <AppHead />
        {status}
      </div>
    )

  if (status === "success") {
    return (
      <>
        <AppHead />
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

  return (
    <>
      <AppHead />
      <main className="grid h-full place-items-center">Loading...</main>
    </>
  )
}
