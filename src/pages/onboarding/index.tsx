import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import {
  type FieldArrayWithId,
  useFieldArray,
  useForm,
  type UseFormRegister,
  type FieldArray,
  type FieldArrayMethodProps
} from "react-hook-form"
import {
  onboardingSchema,
  type OnboardingFormValues
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"

type Step = "first" | "second" | "third" | "fourth"

const initialSchool: OnboardingFormValues["education"] = [
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

const initialWork: OnboardingFormValues["workExperience"] = [
  {
    companyName: "",
    description: "",
    startDate: "",
    endDate: "",
    title: ""
  }
]

const initialSkill: OnboardingFormValues["skills"] = [
  {
    value: ""
  }
]

export default function Onboarding() {
  const { mutate } = api.profile.create.useMutation()

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    setError,
    control,
    getValues
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      education: initialSchool,
      workExperience: initialWork,
      skills: initialSkill
    }
  })

  const {
    fields: educationFields,
    append: appendSchool,
    remove: removeSchool
  } = useFieldArray({
    name: "education",
    control
  })

  const {
    fields: workFields,
    append: appendWork,
    remove: removeWork
  } = useFieldArray({
    name: "workExperience",
    control
  })

  const {
    fields: skillFields,
    append: appendSkill,
    remove: removeSkill
  } = useFieldArray({
    name: "skills",
    control
  })

  const [step, setStep] = useState<Step>("first")

  const handleChangeStep = (step: Step) => {
    setStep(step)
  }
  console.log(errors)
  console.log(getValues("skills"))
  return (
    <div>
      <form className="flex w-full max-w-prose flex-col gap-3">
        <Steps
          step={step}
          educationFields={educationFields}
          register={register}
          workFields={workFields}
          skillFields={skillFields}
          appendSchool={appendSchool}
          appendWork={appendWork}
          appendSkill={appendSkill}
          handleChangeStep={handleChangeStep}
        />
      </form>
    </div>
  )
}

function Steps({
  step,
  educationFields,
  workFields,
  skillFields,
  appendSchool,
  appendWork,
  register,
  appendSkill,
  handleChangeStep
}: {
  step: Step
  educationFields: FieldArrayWithId<OnboardingFormValues, "education", "id">[]
  workFields: FieldArrayWithId<OnboardingFormValues, "workExperience", "id">[]
  skillFields: FieldArrayWithId<OnboardingFormValues, "skills", "id">[]
  register: UseFormRegister<OnboardingFormValues>
  handleChangeStep: (step: Step) => void
  appendSkill: (
    value: FieldArray<OnboardingFormValues, "skills">[],
    options?: FieldArrayMethodProps
  ) => void
  appendSchool: (
    value: FieldArray<OnboardingFormValues, "education">[],
    options?: FieldArrayMethodProps
  ) => void
  appendWork: (
    value: FieldArray<OnboardingFormValues, "workExperience">[],
    options?: FieldArrayMethodProps
  ) => void
}) {
  if (step === "first") {
    return (
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
    )
  }

  if (step === "second") {
    return (
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
          </div>
        ))}

        <button type="button" onClick={() => appendSchool(initialSchool)}>
          Add another
        </button>

        <button type="button" onClick={() => handleChangeStep("third")}>
          Next
        </button>
      </div>
    )
  }

  if (step === "third") {
    return (
      <div className="">
        {workFields.map((field, index) => (
          <div key={index}>
            <input
              type="text"
              placeholder="Company Name"
              className="rounded-sm px-2 py-1"
              {...register(`workExperience.${index}.companyName`)}
            />
            <input
              type="text"
              placeholder="Start Date"
              className="rounded-sm px-2 py-1"
              {...register(`workExperience.${index}.description`)}
            />
            <input
              type="text"
              placeholder="Degree/Certificate"
              className="rounded-sm px-2 py-1"
              {...register(`workExperience.${index}.startDate`)}
            />
            <input
              type="text"
              placeholder="End Date"
              className="rounded-sm px-2 py-1"
              {...register(`workExperience.${index}.endDate`)}
            />
            <input
              type="text"
              placeholder="Address Line"
              className="rounded-sm px-2 py-1"
              {...register(`workExperience.${index}.title`)}
            />
          </div>
        ))}
        <button type="button" onClick={() => appendWork(initialWork)}>
          Add another
        </button>
        <button type="button" onClick={() => handleChangeStep("fourth")}>
          Next
        </button>
      </div>
    )
  }

  if (step === "fourth") {
    return (
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
    )
  }

  return <>No step</>
}
