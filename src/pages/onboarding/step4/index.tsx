import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { MyErrorMessage } from "~/components/my-error-message"
import {
  insertExperienceSchema,
  type InsertExperienceSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"

const initialExperience: InsertExperienceSchema["experience"] = [
  {
    companyName: "",
    description: "",
    startDate: "",
    endDate: "",
    title: ""
  }
]

const maxExperience = 4

export default function Step4() {
  const router = useRouter()

  const { mutate } = api.profile.addEducation.useMutation({
    onError: (error) => {
      toast.error(error.message)
      router.push("/onboarding/step4")
    }
  })

  const handleChangeStep = () => {
    router.push("/onboarding/step5")
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isValid },
    control,
    setFocus
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
    control
  })

  useEffect(() => {
    setFocus("experience.0.companyName")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    console.log(errors)
  }, [errors])
  return (
    <form className="flex w-full max-w-prose flex-col gap-3">
      <div className="">
        {experienceFields.map((field, index) => (
          <div key={field.id}>
            <div className="">
              <label
                htmlFor={`experience.${index}.companyName`}
                className="label"
              >
                <span className="label-text">
                  Company<span className="text-error">*</span>
                </span>
              </label>

              <input
                type="text"
                placeholder="Ex: Google"
                className="rounded-sm px-2 py-1"
                {...register(`experience.${index}.companyName`)}
              />

              <MyErrorMessage
                errors={errors}
                name={`experience.${index}.companyName`}
              />
            </div>

            <div className="">
              <label
                htmlFor={`experience.${index}.description`}
                className="label"
              >
                <span className="label-text">
                  Write 3 to 5 accomplishments
                  <span className="text-error">*</span>
                </span>
              </label>

              <input
                type="text"
                placeholder="Start Date"
                className="rounded-sm px-2 py-1"
                {...register(`experience.${index}.description`)}
              />

              <MyErrorMessage
                errors={errors}
                name={`experience.${index}.description`}
              />
            </div>

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

        {experienceFields.length < maxExperience && (
          <button
            className="btn btn-primary"
            disabled={!(isDirty && isValid)}
            type="button"
            onClick={() => appendWork(initialExperience)}
          >
            Add another
          </button>
        )}

        <button className="btn btn-primary" type="submit">
          Next
        </button>
      </div>
    </form>
  )
}
