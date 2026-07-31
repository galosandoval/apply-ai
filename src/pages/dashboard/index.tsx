import Head from "next/head"
import { type RouterOutputs, api } from "~/utils/api"
import { type Message, useChat } from "ai/react"
import { useUser } from "~/utils/useUser"
import { type ChangeEvent, useState, type FormEvent } from "react"
import {
  ResumeDocument,
  type OnEditField,
  type ResumeDocumentData
} from "~/components/resume"
import { PromptInput } from "~/components/prompt-input"
import {
  type InsertResumeSchema,
  insertResumeSchema,
  type DownloadPdfSchema
} from "~/server/db/crud-schema"
import { Button } from "~/components/ui/button"
import { testPrompt } from "~/lib/test-prompt"
import { type ChatParams, chatParams } from "../api/resume/chat"
import toast from "react-hot-toast"
import { useAppForm } from "~/components/use-app-form"

export default function Dashboard() {
  return (
    <>
      <Head>
        <title>GPT Job</title>
        <meta name="description" content="Created by Galo Sandoval" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Main />
    </>
  )
}

function Main() {
  const { id } = useUser()

  const { data, status } = api.profile.read.useQuery(
    { userId: id },
    {
      enabled: !!id
    }
  )

  if (status === "success") {
    return (
      <main className="top-0 my-auto h-full overflow-y-auto md:grid md:place-items-center">
        <PromptForm data={data} />
      </main>
    )
  }

  return (
    <main className="my-auto h-full overflow-y-auto md:grid md:place-items-center">
      loading...
    </main>
  )
}

let initialInput = ``

if (process.env.NODE_ENV === "development") {
  initialInput = testPrompt
}

function parseChatBody(data: Omit<ChatParams, "messages">) {
  try {
    const body = chatParams.omit({ messages: true }).parse(data)

    return {
      experience: JSON.stringify(body.experience),
      education: JSON.stringify(body.education),
      profession: body.profession
    }
  } catch (error) {
    console.error(error)
    toast.error("Error parsing chat params")
  }
}

function PromptForm({ data }: { data: RouterOutputs["profile"]["read"] }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      initialInput,
      api: "/api/resume/chat"
    })

  const hasMessages = messages.length > 0

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const body = parseChatBody({
      experience: JSON.stringify(
        data.experience.map((e) => ({
          name: e.name,
          startDate: e.startDate,
          endDate: e.endDate,
          title: e.title,
          bullets: e.bullets
        }))
      ),
      education: JSON.stringify(
        data.education.map((e) => ({
          name: e.name,
          startDate: e.startDate,
          endDate: e.endDate,
          degree: e.degree,
          description: e.description,
          gpa: e.gpa
        }))
      ),
      profession: data.profession
    })

    handleSubmit(e, { options: { body } })
  }

  if (isLoading) {
    return <p>Loading...</p>
  }

  if (hasMessages) {
    return (
      <Chat
        messages={messages}
        input={input}
        profile={data}
        handleInputChange={handleInputChange}
        onSubmit={onSubmit}
      />
    )
  }

  return (
    <form
      className="flex w-full flex-col gap-2 md:max-w-[60%]"
      onSubmit={onSubmit}
    >
      <PromptInput handleInputChange={handleInputChange} input={input} />
    </form>
  )
}

function Chat({
  messages,
  input,
  profile,
  handleInputChange,
  onSubmit
}: {
  messages: Message[]
  input: string
  profile: RouterOutputs["profile"]["read"]
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-4">
        {messages.map((message, index) => (
          <ChatMessage profile={profile} key={index} message={message} />
        ))}
      </div>
      <form
        className="mx-auto flex w-full max-w-md flex-col gap-2 pb-12"
        onSubmit={onSubmit}
      >
        <PromptInput handleInputChange={handleInputChange} input={input} />
      </form>
    </div>
  )
}

function ChatMessage({
  message,
  profile
}: {
  message: Message
  profile: RouterOutputs["profile"]["read"]
}) {
  if (message.role === "user") {
    return null
  }

  if (message.role === "assistant") {
    return <AssistantMessage content={message.content} profile={profile} />
  }

  return <p className="whitespace-pre-line">{message.content}</p>
}

function AssistantMessage({
  content,
  profile
}: {
  content: string
  profile: RouterOutputs["profile"]["read"]
}) {
  const [savedResumeId, setSavedResumeId] = useState("")

  const { mutate } = api.resume.create.useMutation({
    onSuccess: (data) => {
      setSavedResumeId(data.resumeId)
    }
  })

  const parsedContent = parseContent(content)

  const { watch, setValue, handleSubmit } = useAppForm(insertResumeSchema, {
    values: {
      education:
        parsedContent?.education.map((e) => ({ ...e, name: e.name })) ?? [],
      experience: parsedContent?.experience ?? [],
      skills:
        profile?.skills?.map((s) => ({
          ...s,
          all: s.all.join(", ")
        })) ?? [],
      profession: parsedContent?.profession ?? "",
      email: profile.email ?? "",
      phone: profile.contact?.phone ?? "",
      location: profile.contact?.location ?? "",
      portfolio: profile.contact?.portfolio ?? "",
      linkedIn: profile.contact?.linkedIn ?? ""
    }
  })

  if (!parsedContent) {
    return <p className="whitespace-pre-line">{content}</p>
  }

  const onSubmitSaveResume = async (data: InsertResumeSchema) => {
    mutate({
      ...data,
      education: data.education.map((e) => ({ ...e })),
      skills: data.skills,
      interests: data.interests ?? "",
      profileId: profile.id
    })
  }

  const resumeData: ResumeDocumentData = {
    fullName: `${profile.firstName} ${profile.lastName}`,
    profession: watch("profession"),
    email: watch("email"),
    phone: watch("phone"),
    linkedIn: watch("linkedIn"),
    portfolio: watch("portfolio"),
    location: watch("location"),
    skills: watch("skills"),
    experience: watch("experience"),
    education: watch("education")
  }

  /**
   * Commits one `Editable` edit into form state.
   *
   * The chat preview edits an unsaved resume, so there is no row to autosave to
   * — `resume.updateField` and `useEditableResume` serve `/resume/[id]`, where
   * the resume already exists. Edits here live in form state until saved.
   */
  const handleEditField: OnEditField = (path, value) => {
    setValue(path, value, { shouldDirty: true })
  }

  const handleDownloadPdf = async () => {
    const requestBody: DownloadPdfSchema = resumeData

    try {
      const response = await fetch("/api/resume/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      })

      const blob = await response.blob()

      const link = document.createElement("a")
      link.href = window.URL.createObjectURL(blob)
      link.download = `your-file-name.pdf`
      link.click()
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmitSaveResume)}
      className="flex flex-col items-center gap-4 overflow-y-auto pt-16"
    >
      <ResumeDocument data={resumeData} onEdit={handleEditField} />
      <Button onClick={handleDownloadPdf} type="button">
        Download
      </Button>
    </form>
  )
}

function parseContent(content: string) {
  let parsed: null | FinishedParsed = null

  try {
    parsed = JSON.parse(content) as FinishedParsed
  } catch (error) {
    parsed = null
    console.warn(error)
  }

  console.log(parsed)

  return parsed
}

type EducationParsed = {
  description: string
  name: string
  startDate: string
  endDate: string
  degree: string
  gpa: string
}

type ExperienceParsed = {
  name: string
  startDate: string
  endDate: string
  bullets: string[]
  title: string
}

type InterestsParsed = string

type FinishedParsed = {
  education: EducationParsed[]
  experience: ExperienceParsed[]
  interests: InterestsParsed
  profession: string
}
