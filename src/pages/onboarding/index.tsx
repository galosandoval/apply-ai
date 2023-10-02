import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
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

  const handleChangeStep = (step: Step) => {
    setStep(step)
  }
  return (
    <div>
      <Steps step={step} handleChangeStep={handleChangeStep} />
    </div>
  )
}

function Steps({
  step,

  handleChangeStep
}: {
  step: Step
  handleChangeStep: (step: Step) => void
}) {
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

  return <>No step</>
}

function Step1({
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
  } = useForm<InsertProfileSchema>({
    resolver: zodResolver(insertProfileSchema)
  })

  return (
    <form className="flex w-full max-w-prose flex-col gap-3">
      <div className="">
        <input
          type="text"
          placeholder="first name"
          className="rounded-sm px-2 py-1"
          {...register("firstName")}
        />
        <input
          type="text"
          placeholder="last name"
          className="rounded-sm px-2 py-1"
          {...register("lastName")}
        />
        <input
          type="text"
          placeholder="your job title"
          className="rounded-sm px-2 py-1"
          {...register("profession")}
        />
        <textarea
          placeholder="intro"
          className="rounded-sm px-2 py-1"
          {...register("introduction")}
        ></textarea>

        <button
          type="button"
          onClick={() => handleChangeStep("second")}
          className=""
        >
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
          <div key={index}>
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

            <button type="button" onClick={() => removeSchool(index)}>
              Remove
            </button>
          </div>
        ))}

        <button type="button" onClick={() => appendSchool(initialSchool)}>
          Add another
        </button>

        <button type="button" onClick={() => handleChangeStep("third")}>
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
          <div key={index}>
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
        <button type="button" onClick={() => appendWork(initialExperience)}>
          Add another
        </button>
        <button type="button" onClick={() => handleChangeStep("fourth")}>
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

  return (
    <form className="flex w-full max-w-prose flex-col gap-3">
      <div className="">
        {skillFields.map((field, index) => (
          <div key={index}>
            <input
              type="text"
              placeholder="Skill"
              {...register(`skills.${index}.value`)}
            />
          </div>
        ))}
        <button type="button" onClick={() => appendSkill(initialSkill)}>
          Add another
        </button>
        <button type="button" onClick={() => handleChangeStep("first")}>
          Next
        </button>
      </div>
    </form>
  )
}
