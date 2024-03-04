import Head from "next/head"
import { useRouter } from "next/router"
import { Resume } from "~/components/resume"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

export default function ResumeView() {
  const router = useRouter()
  const { id: resumeId, name } = router.query

  const { data, status } = api.resume.readById.useQuery(
    { resumeId: resumeId as string },
    { enabled: !!resumeId }
  )

  const { id: userId, email } = useUser()

  const { data: profile } = api.profile.read.useQuery(
    { userId },
    { enabled: !!userId }
  )

  if (status === "error")
    return (
      <div>
        <Head>
          <title>gptBJ</title>
          <meta name="description" content="Generated by create-t3-app" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        {status}
      </div>
    )

  if (status === "success" && profile?.contact) {
    const contact = profile?.contact

    return (
      <>
        <Head>
          <title>gptBJ</title>
          <meta name="description" content="Generated by create-t3-app" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <Resume
          data={{
            ...data,
            firstAndLastName: name as string,
            email: email ?? "",
            location: contact?.location ?? "",
            phone: contact?.phone ?? "",
            linkedIn: contact?.linkedIn ?? "",
            portfolio: contact?.portfolio ?? ""
          }}
        />
      </>
    )
  }

  return (
    <>
      <Head>
        <title>gptBJ</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="grid h-full place-items-center">Loading...</main>
    </>
  )
}
