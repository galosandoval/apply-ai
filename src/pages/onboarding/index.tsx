import { ErrorMessage } from "@hookform/error-message"
import { zodResolver } from "@hookform/resolvers/zod"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { MyErrorMessage } from "~/components/my-error-message"
import {
  updateProfileSchema,
  insertEducationSchema,
  type InsertEducationSchema,
  insertExperienceSchema,
  type InsertExperienceSchema,
  type InsertSkillsSchema,
  insertSkillsSchema,
  type InsertNameSchema,
  insertNameSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"

type Step = "first" | "second" | "third" | "fourth" | "fifth"

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

  const handleChangeStep = (step: Step) => {
    setStep(step)
  }

  if (step === "first") {
    return <Step1 handleChangeStep={handleChangeStep} />
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

  if (step === "fifth") {
    return <Step5 handleChangeStep={handleChangeStep} />
  }

  return <>No step</>
}

function Step1({
  handleChangeStep
}: {
  handleChangeStep: (step: Step) => void
}) {
  const utils = api.useContext()

  const { mutate } = api.profile.create.useMutation({
    onError: (error) => {
      toast.error(error.message)
      handleChangeStep("first")
    },

    onSuccess: (data) => {
      if (data?.userId) {
        utils.profile.read.setData({ userId: data.userId }, { ...data })
      }
    }
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus
  } = useForm<InsertNameSchema>({
    resolver: zodResolver(insertNameSchema)
  })

  const onSubmit = async (data: InsertNameSchema) => {
    mutate(data)
    handleChangeStep("second")
  }

  useEffect(() => {
    setFocus("firstName")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full max-w-prose flex-col gap-3"
    >
      <div className="">
        <label htmlFor="firstName" className="label">
          <span className="label-text">
            First Name <span className="text-error">*</span>
          </span>
        </label>

        <input
          id="firstName"
          type="text"
          className="input input-bordered"
          {...register("firstName")}
        />

        <MyErrorMessage errors={errors} name="firstName" />
      </div>

      <div className="">
        <label htmlFor="lastName" className="label">
          <span className="label-text">
            Last Name <span className="text-error">*</span>
          </span>
        </label>

        <input
          id="lastName"
          type="text"
          className="input input-bordered"
          {...register("lastName")}
        />

        <MyErrorMessage errors={errors} name="lastName" />
      </div>
      <button type="submit" className="btn btn-primary">
        Next
      </button>
    </form>
  )
}

function Step2({
  handleChangeStep
}: {
  handleChangeStep: (step: Step) => void
}) {
  const { mutate } = api.profile.update.useMutation({
    onError: (error) => {
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
  } = useForm<updateProfileSchema>({
    resolver: zodResolver(updateProfileSchema)
  })

  const onSubmit = async (data: updateProfileSchema) => {
    mutate(data)
    handleChangeStep("third")
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full max-w-prose flex-col gap-3"
    >
      <div className="">
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

function Step3({
  handleChangeStep
}: {
  handleChangeStep: (step: Step) => void
}) {
  const { mutate } = api.profile.addEducation.useMutation()

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

  const onSubmit = async (data: InsertEducationSchema) => {
    console.log(data)
    // mutate(data)
    handleChangeStep("fourth")
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full max-w-prose flex-col gap-3"
    >
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

            <MyErrorMessage
              errors={errors}
              name={`education.${index}.description`}
            />
          </div>
        ))}

        <button
          className="btn btn-primary"
          type="button"
          onClick={() => appendSchool(initialSchool)}
        >
          Add another
        </button>

        <button className="btn btn-primary" type="submit">
          Next
        </button>
      </div>
    </form>
  )
}

function Step4({
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
          onClick={() => handleChangeStep("fifth")}
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

function Step5({
  handleChangeStep
}: {
  handleChangeStep: (step: Step) => void
}) {
  const { id } = useUser()

  const { mutate } = api.profile.createSkills.useMutation()

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
