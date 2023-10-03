import { ErrorMessage } from "@hookform/error-message"
import { zodResolver } from "@hookform/resolvers/zod"
import { router } from "@trpc/server"
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import { use, useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { MyErrorMessage } from "~/components/my-error-message"
import {
  type InsertProfileSchema,
  insertProfileSchema,
  insertEducationSchema,
  type InsertEducationSchema,
  insertExperienceSchema,
  type InsertExperienceSchema,
  type InsertSkillsSchema,
  insertSkillsSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"

type Step = "first" | "second" | "third" | "fourth"

const initialSchool: InsertEducationSchema["education"] = [
  {
    degree: "",
    description: "",
    name: "",
    endDate: "",
    gpa: "",
    location: "",
    startDate: ""
  }
]

const initialExperience: InsertExperienceSchema["experience"] = [
  {
    companyName: "",
    description: "",
    startDate: "",
    endDate: "",
    title: ""
  }
]

const initialSkill: InsertSkillsSchema["skills"] = [{ value: "" }]

export default function Onboarding() {
  const [step, setStep] = useState<Step>("first")

  const { id: userId } = useUser()
  const handleChangeStep = (step: Step) => {
    setStep(step)
  }

  if (step === "first") {
    return <Step1 userId={userId} handleChangeStep={handleChangeStep} />
  }

  if (step === "second") {
    return <Step2 handleChangeStep={handleChangeStep} />
  }

  if (step === "third") {
    return <Step3 handleChangeStep={handleChangeStep} />
  }

  if (step === "fourth") {
    return <Step4 handleChangeStep={handleChangeStep} />
  }

  return <>No step</>
}

function Step1({
  handleChangeStep,
  userId
}: {
  handleChangeStep: (step: Step) => void
  userId: string
}) {
  const { mutate } = api.user.addProfile.useMutation({
    onError: (error) => {
      console.log(error)
      toast.error(error.message)
      handleChangeStep("first")
    }
  })
  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    setError,
    control,
    getValues
  } = useForm<InsertProfileSchema>({
    resolver: zodResolver(insertProfileSchema)
  })

  const onSubmit = async (data: InsertProfileSchema) => {
    console.log(data)
    const params: InsertProfileSchema = {
      ...data
    }
    mutate(params)
    handleChangeStep("second")
  }
  console.log(errors)
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full max-w-prose flex-col gap-3"
    >
      <div className="">
        <input
          type="text"
          placeholder="first name"
          className="rounded-sm px-2 py-1"
          {...register("firstName")}
        />
        <MyErrorMessage errors={errors} name="firstName" />

        <input
          type="text"
          placeholder="last name"
          className="rounded-sm px-2 py-1"
          {...register("lastName")}
        />
        <MyErrorMessage errors={errors} name="lastName" />

        <input
          type="text"
          placeholder="Ex: Full Stack Developer"
          className="rounded-sm px-2 py-1"
          {...register("profession")}
        />
        <MyErrorMessage errors={errors} name="profession" />

        <textarea
          placeholder="Ex: I am a full stack developer with 5 years of experience. I have worked with ..."
          className="rounded-sm px-2 py-1"
          {...register("introduction")}
        ></textarea>
        <MyErrorMessage errors={errors} name="introduction" />

        <textarea
          placeholder="Ex: I like to go hiking, biking, and swimming."
          className="rounded-sm px-2 py-1"
          {...register("interests")}
        ></textarea>
        <MyErrorMessage errors={errors} name="interests" />

        <button type="submit" className="btn btn-primary">
          Next
        </button>
      </div>
    </form>
  )
}

function Step2({
  handleChangeStep
}: {
  handleChangeStep: (step: Step) => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    setError,
    control,
    getValues
  } = useForm<InsertEducationSchema>({
    resolver: zodResolver(insertEducationSchema),
    defaultValues: {
      education: initialSchool
    }
  })

  const {
    fields: educationFields,
    append: appendSchool,
    remove: removeSchool
  } = useFieldArray({
    name: "education",
    control,
    rules: { required: true, maxLength: 5 }
  })

  return (
    <form className="flex w-full max-w-prose flex-col gap-3">
      <div className="">
        {educationFields.map((field, index) => (
          <div key={field.id}>
            <input
              type="text"
              placeholder="School Name"
              className="rounded-sm px-2 py-1"
              {...register(`education.${index}.name`)}
            />
            <input
              type="text"
              placeholder="Start Date"
              className="rounded-sm px-2 py-1"
              {...register(`education.${index}.startDate`)}
            />
            <input
              type="text"
              placeholder="End Date"
              className="rounded-sm px-2 py-1"
              {...register(`education.${index}.endDate`)}
            />
            <input
              type="text"
              placeholder="Degree/Certificate"
              className="rounded-sm px-2 py-1"
              {...register(`education.${index}.degree`)}
            />
            <input
              type="text"
              placeholder="Address Line"
              className="rounded-sm px-2 py-1"
              {...register(`education.${index}.location`)}
            />
            <input
              type="text"
              placeholder="GPA"
              className="rounded-sm px-2 py-1"
              {...register(`education.${index}.gpa`)}
            />
            <input
              type="text"
              placeholder="Any other details?"
              className="rounded-sm px-2 py-1"
              {...register(`education.${index}.description`)}
            />

            <button
              className="btn btn-primary"
              type="button"
              onClick={() => removeSchool(index)}
            >
              Remove
            </button>
          </div>
        ))}

        <button
          className="btn btn-primary"
          type="button"
          onClick={() => appendSchool(initialSchool)}
        >
          Add another
        </button>

        <button
          className="btn btn-primary"
          type="button"
          onClick={() => handleChangeStep("third")}
        >
          Next
        </button>
      </div>
    </form>
  )
}

function Step3({
  handleChangeStep
}: {
  handleChangeStep: (step: Step) => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    setError,
    control,
    getValues
  } = useForm<InsertExperienceSchema>({
    resolver: zodResolver(insertExperienceSchema),
    defaultValues: {
      experience: initialExperience
    }
  })

  const {
    fields: experienceFields,
    append: appendWork,
    remove: removeWork
  } = useFieldArray({
    name: "experience",
    control,
    rules: { required: true, maxLength: 5 }
  })

  return (
    <form className="flex w-full max-w-prose flex-col gap-3">
      <div className="">
        {experienceFields.map((field, index) => (
          <div key={field.id}>
            <input
              type="text"
              placeholder="Company Name"
              className="rounded-sm px-2 py-1"
              {...register(`experience.${index}.companyName`)}
            />
            <input
              type="text"
              placeholder="Start Date"
              className="rounded-sm px-2 py-1"
              {...register(`experience.${index}.description`)}
            />
            <input
              type="text"
              placeholder="Degree/Certificate"
              className="rounded-sm px-2 py-1"
              {...register(`experience.${index}.startDate`)}
            />
            <input
              type="text"
              placeholder="End Date"
              className="rounded-sm px-2 py-1"
              {...register(`experience.${index}.endDate`)}
            />
            <input
              type="text"
              placeholder="Address Line"
              className="rounded-sm px-2 py-1"
              {...register(`experience.${index}.title`)}
            />
          </div>
        ))}
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => appendWork(initialExperience)}
        >
          Add another
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => handleChangeStep("fourth")}
        >
          Next
        </button>
      </div>
    </form>
  )
}

function useUser() {
  const { data: session } = useSession()

  if (!session) {
    return { id: "" }
  }

  return session!.user
}

function Step4({
  handleChangeStep
}: {
  handleChangeStep: (step: Step) => void
}) {
  const { id } = useUser()

  const { mutate } = api.user.createSkills.useMutation()

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    setError,
    control,
    getValues
  } = useForm<InsertSkillsSchema>({
    resolver: zodResolver(insertSkillsSchema),
    defaultValues: {
      skills: initialSkill
    }
  })

  const {
    fields: skillFields,
    append: appendSkill,
    remove: removeSkill
  } = useFieldArray({
    name: "skills",
    control,
    rules: { required: true, maxLength: 10 }
  })

  const onSubmit = async (data: InsertSkillsSchema) => {
    console.log(data)
    mutate({ skills: data.skills, userId: id })
  }

  console.log(errors)

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full max-w-prose flex-col gap-3"
    >
      <div className="">
        {skillFields.map((field, index) => (
          <div key={field.id} className="">
            <input placeholder="Skill" {...register(`skills.${index}.value`)} />
            <MyErrorMessage errors={errors} name={`skills.${index}.value`} />
            <ErrorMessage
              errors={errors}
              name={`skills.${index}.value`}
              render={({ message }) => <p className="text-error">{message}</p>}
            />
          </div>
        ))}
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => appendSkill(initialSkill)}
        >
          Add another
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => handleChangeStep("first")}
        >
          Next
        </button>

        <button className="btn btn-primary" type="submit">
          Submit
        </button>
      </div>
    </form>
  )
}
