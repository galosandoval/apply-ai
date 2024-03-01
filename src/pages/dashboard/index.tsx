import Head from "next/head"
import { type RouterOutputs, api } from "~/utils/api"
import { type Message, useChat } from "ai/react"
import { useUser } from "~/utils/useUser"
import { type ChangeEvent, useState, type FormEvent } from "react"
import { type EditableFields, ResumeInChat } from "~/components/resume"
import { PromptInput } from "~/components/prompt-input"
import { useFieldArray, useForm } from "react-hook-form"
import { InsertResumeSchema, insertResumeSchema } from "~/server/db/crud-schema"
import { zodResolver } from "@hookform/resolvers/zod"

export default function Dashboard() {
  // interface PdfRequestBody {
  //   resumeId: string
  // }

  // const handleDownloadPdf = async () => {
  //   const requestBody: PdfRequestBody = { resumeId }

  //   try {
  //     const response = await fetch("/api/resume/pdf", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json"
  //       },
  //       body: JSON.stringify(requestBody)
  //     })

  //     const blob = await response.blob()

  //     const link = document.createElement("a")
  //     link.href = window.URL.createObjectURL(blob)
  //     link.download = `your-file-name.pdf`
  //     link.click()
  //   } catch (error) {
  //     console.error(error)
  //   }
  // }

  return (
    <>
      <Head>
        <title>GPT Job</title>
        <meta name="description" content="Generated by create-t3-app" />
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
      <main className="my-auto h-full overflow-y-auto pb-16 pt-4 md:grid md:place-items-center">
        <PromptForm data={data} />
      </main>
    )
  }

  return (
    <main className="my-auto h-full overflow-y-auto pb-16 pt-4 md:grid md:place-items-center">
      loading...
    </main>
  )
}

function PromptForm({ data }: { data: RouterOutputs["profile"]["read"] }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/resume/chat",
      body: data
        ? {
            s: data?.skills?.join(", "),
            experience: JSON.stringify(data.experience),
            education: JSON.stringify(data.education),
            interests: data.interests,
            profession: data.profession
          }
        : {}
    })

  const hasMessages = messages.length > 0

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    handleSubmit(e)
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
        className="mx-auto flex w-full max-w-md flex-col gap-2"
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

function initialEditingState({
  education,
  experience
}: {
  education: EducationParsed[]
  experience: ExperienceParsed[]
}) {
  return {
    skills: false,
    interests: false,
    profession: false,
    linkedIn: false,
    portfolio: false,
    location: false,
    phone: false,
    firstName: false,
    lastName: false,
    email: false,
    summary: false,
    education:
      education.map((_e) => ({
        schoolName: false,
        degree: false,
        startDate: false,
        endDate: false,
        description: false,
        gpa: false,
        location: false
      })) ?? [],
    experience:
      experience.map((_e) => ({
        title: false,
        companyName: false,
        startDate: false,
        endDate: false,
        description: false
      })) ?? []
  }
}

function AssistantMessage({
  content,
  profile
}: {
  content: string
  profile: RouterOutputs["profile"]["read"]
}) {
  // const { mutate } = api.resume.create.useMutation()

  const parsedContent = parseContent(content)

  const [isEditing, setIsEditing] = useState<EditableFields>(
    initialEditingState({
      education: parsedContent?.education ?? [],
      experience: parsedContent?.experience ?? []
    })
  )

  const { control, register } = useForm<InsertResumeSchema>({
    resolver: zodResolver(insertResumeSchema),
    values: {
      education:
        parsedContent?.education.map((e) => ({ ...e, name: e.schoolName })) ??
        [],
      experience: parsedContent?.experience ?? [],
      skills: parsedContent?.skills?.join(", ") ?? "",
      interests: parsedContent?.interests ?? "",
      introduction: parsedContent?.summary ?? "",
      profession: parsedContent?.profession ?? "",
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      email: profile.email ?? "",
      phone: profile.contact?.phone ?? "",
      location: profile.contact?.location ?? "",
      portfolio: profile.contact?.portfolio ?? "",
      linkedIn: profile.contact?.linkedIn ?? ""
    }
  })

  const {
    fields: educationFields,
    append: appendEducation,
    remove: removeEducation
  } = useFieldArray({
    name: "education",
    control
  })

  const {
    fields: experienceFields,
    append: appendExperience,
    remove: removeExperience
  } = useFieldArray({
    name: "experience",
    control
  })

  if (!parsedContent) {
    return <p className="whitespace-pre-line">{content}</p>
  }

  // const handleSaveAsResume = () => {
  //   mutate({
  //     education: parsedContent?.education ?? [],
  //     experience: parsedContent?.experience ?? [],
  //     skills: parsedContent?.skills ?? [],
  //     interests: parsedContent?.interests ?? "",
  //     introduction: parsedContent?.summary ?? "",
  //     profession: parsedContent?.profession ?? "",
  //     profileId
  //   })
  // }

  const startEditing = (
    id: keyof typeof isEditing,
    index?: number,
    key?:
      | keyof (typeof isEditing.experience)[number]
      | keyof (typeof isEditing.education)[number]
  ) => {
    const initialState = initialEditingState(parsedContent)

    const toChange = initialState[id]

    if (index !== undefined && key && Array.isArray(toChange)) {
      // @ts-ignore - key exists
      toChange[index][key] = !toChange[index][key]
    } else {
      // @ts-ignore - key exists
      initialState[id] = !toChange
    }

    setIsEditing(initialState)
  }

  const finishEditing = () => {
    setIsEditing(initialEditingState(parsedContent))
  }

  return (
    <div className="flex max-h-[80svh] flex-col items-center gap-4 overflow-y-auto">
      <ResumeInChat
        email="galo.sandoval.dev@gmail.com"
        firstName="Galo"
        lastName="Sandoval"
        location="Remote"
        parsed={parsedContent}
        phone="714-944-3655"
        linkedIn="linkedin.com/in/galo-sandoval"
        portfolio="galosandoval.dev"
        isEditing={isEditing}
        startEditing={startEditing}
        finishEditing={finishEditing}
        register={register}
      />
    </div>
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

  return parsed
}

type EducationParsed = {
  description: string
  schoolName: string
  startDate: string
  endDate: string
  degree: string
  gpa: string
  // keyAchievements: string[]
}

type SkillParsed = string[]

type ExperienceParsed = {
  companyName: string
  startDate: string
  endDate: string
  description: string
  title: string
  // keyAchievements: string[]
}

type InterestsParsed = string

export type FinishedParsed = {
  education: EducationParsed[]
  skills: SkillParsed
  experience: ExperienceParsed[]
  interests: InterestsParsed
  summary: string
  profession: string
}
