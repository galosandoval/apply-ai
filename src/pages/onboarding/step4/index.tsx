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
import { useUser } from "~/utils/useUser"

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

  const { id } = useUser()

  const { data: profile } = api.profile.read.useQuery(
    { userId: id },
    { enabled: !!id }
  )

  const { mutate } = api.profile.addWork.useMutation({
    onError: (error) => {
      toast.error(error.message)
      router.push("/onboarding/step4")
    },

    onMutate: () => router.push("/onboarding/step5")
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setFocus
  } = useForm<InsertExperienceSchema>({
    resolver: zodResolver(insertExperienceSchema),

    defaultValues: {
      experience: profile?.experience.length
        ? profile.experience
        : initialExperience
    },

    values: {
      experience: profile?.experience.length
        ? profile.experience
        : initialExperience
    }
  })

  const { fields, append, remove } = useFieldArray({
    name: "experience",
    control
  })

  const onSubmit = async (data: InsertExperienceSchema) => {
    const experienceToSubmit = data.experience.map((experience) => ({
      ...experience,
      profileId: profile?.id
    }))

    mutate({ experience: experienceToSubmit })
  }

  useEffect(() => {
    setFocus("experience.0.companyName")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex min-h-screen flex-col items-center justify-center gap-3"
    >
      <h1>Experience</h1>

      {fields.map((field, index) => (
        <div key={field.id}>
          <div className="">
            <label
              htmlFor={`experience.${index}.companyName`}
              className="label"
            >
              <span className="label-text">
                Company Name<span className="text-error">*</span>
              </span>
            </label>

            <input
              id={`experience.${index}.companyName`}
              type="text"
              placeholder="Ex: Google"
              className="input input-bordered w-full rounded-sm px-2  py-1"
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

            <textarea
              id={`experience.${index}.description`}
              placeholder="Collaborated closely with cross-functional teams to ensure seamless integration of new features and improvements..."
              className="rounded-sm px-2 py-1"
              {...register(`experience.${index}.description`)}
            />

            <MyErrorMessage
              errors={errors}
              name={`experience.${index}.description`}
            />
          </div>

          <div className="">
            <label htmlFor={`experience.${index}.startDate`} className="label">
              <span className="label-text">
                Start Date
                <span className="text-error">*</span>
              </span>
            </label>

            <input
              id={`experience.${index}.startDate`}
              type="date"
              placeholder="Start Date"
              className="input input-bordered w-full rounded-sm px-2 py-1"
              {...register(`experience.${index}.startDate`)}
            />

            <MyErrorMessage
              errors={errors}
              name={`experience.${index}.startDate`}
            />
          </div>

          <div className="">
            <label htmlFor={`experience.${index}.endDate`} className="label">
              <span className="label-text">
                End Date
                <span className="text-error">*</span>
              </span>
            </label>

            <input
              id={`experience.${index}.endDate`}
              type="date"
              placeholder="End Date"
              className="input input-bordered w-full rounded-sm px-2 py-1"
              {...register(`experience.${index}.endDate`)}
            />

            <MyErrorMessage
              errors={errors}
              name={`experience.${index}.endDate`}
            />
          </div>

          <div className="">
            <label htmlFor={`experience.${index}.title`} className="label">
              <span className="label-text">
                Title
                <span className="text-error">*</span>
              </span>
            </label>

            <input
              id={`experience.${index}.title`}
              type="text"
              placeholder="Ex: Software Engineer"
              className="input input-bordered w-full rounded-sm px-2 py-1"
              {...register(`experience.${index}.title`)}
            />

            <MyErrorMessage
              errors={errors}
              name={`experience.${index}.title`}
            />
          </div>

          {fields.length > 1 ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => remove(index)}
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}

      <MyErrorMessage errors={errors} name="experience.root" />

      {fields.length < maxExperience && (
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => append(initialExperience)}
        >
          Add another
        </button>
      )}

      <button className="btn btn-primary" type="submit">
        Next
      </button>
    </form>
  )
}
