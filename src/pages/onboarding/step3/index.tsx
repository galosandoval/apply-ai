import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { MyErrorMessage } from "~/components/my-error-message"
import {
  insertEducationSchema,
  type InsertEducationSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"

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

const maxSchools = 4

export default function Step3() {
  const router = useRouter()

  const { mutate } = api.profile.addEducation.useMutation({
    onError: (error) => {
      toast.error(error.message)
      router.push("/onboarding/step3")
    }
  })

  const handleChangeStep = () => {
    router.push("/onboarding/step4")
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isValid },
    control,
    setFocus
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
    control
  })

  const onSubmit = async (data: InsertEducationSchema) => {
    console.log(data)
    mutate(data)
    handleChangeStep()
  }

  useEffect(() => {
    setFocus("education.0.name")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    console.log(errors)
  }, [errors])
  console.log(errors.root?.message)
  console.log(errors.education?.[0]?.root?.message)

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full max-w-prose flex-col gap-3"
    >
      <div className="">
        {educationFields.map((field, index) => (
          <div key={field.id}>
            <div className="">
              <label htmlFor={`education.${index}.name`} className="label">
                <span className="label-text">
                  Institution Name <span className="text-error">*</span>
                </span>
              </label>

              <input
                type="text"
                id={`education.${index}.name`}
                placeholder="Ex: University of California, Berkeley"
                className="rounded-sm px-2 py-1"
                {...register(`education.${index}.name`)}
              />

              <MyErrorMessage
                errors={errors}
                name={`education.${index}.name`}
              />
            </div>

            <div className="">
              <label htmlFor={`education.${index}.startDate`} className="label">
                <span className="label-text">
                  Start <span className="text-error">*</span>
                </span>
              </label>

              <input
                id={`education.${index}.startDate`}
                type="text"
                placeholder="Ex: Sept 2017"
                className="rounded-sm px-2 py-1"
                {...register(`education.${index}.startDate`)}
              />
              <MyErrorMessage
                errors={errors}
                name={`education.${index}.startDate`}
              />
            </div>

            <div className="">
              <label htmlFor={`education.${index}.endDate`} className="label">
                <span className="label-text">
                  End <span className="text-error">*</span>
                </span>
              </label>

              <input
                id={`education.${index}.endDate`}
                type="text"
                placeholder="Ex: May 2021"
                className="rounded-sm px-2 py-1"
                {...register(`education.${index}.endDate`)}
              />
              <MyErrorMessage
                errors={errors}
                name={`education.${index}.endDate`}
              />
            </div>

            <div className="">
              <label htmlFor={`education.${index}.degree`} className="label">
                <span className="label-text">
                  Degree/Certificate <span className="text-error">*</span>
                </span>
              </label>

              <input
                id={`education.${index}.degree`}
                type="text"
                placeholder="Ex: Computer Science"
                className="rounded-sm px-2 py-1"
                {...register(`education.${index}.degree`)}
              />

              <MyErrorMessage
                errors={errors}
                name={`education.${index}.degree`}
              />
            </div>

            <div className="">
              <label htmlFor={`education.${index}.location`} className="label">
                <span className="label-text">Location</span>
              </label>

              <input
                id={`education.${index}.location`}
                type="text"
                placeholder="Ex: Berkely, CA"
                className="rounded-sm px-2 py-1"
                {...register(`education.${index}.location`)}
              />

              <MyErrorMessage
                errors={errors}
                name={`education.${index}.location`}
              />
            </div>

            <div className="">
              <label htmlFor={`education.${index}.gpa`} className="label">
                <span className="label-text">GPA</span>
              </label>

              <input
                id={`education.${index}.gpa`}
                type="text"
                className="rounded-sm px-2 py-1"
                {...register(`education.${index}.gpa`)}
              />

              <MyErrorMessage errors={errors} name={`education.${index}.gpa`} />
            </div>

            <div className="">
              <label
                htmlFor={`education.${index}.description`}
                className="label"
              >
                <span className="label-text">
                  Anything extra you want a hiring manager to know
                </span>
              </label>

              <input
                id={`education.${index}.description`}
                type="text"
                className="rounded-sm px-2 py-1"
                placeholder="Ex: I was the president of the computer science club."
                {...register(`education.${index}.description`)}
              />

              <MyErrorMessage
                errors={errors}
                name={`education.${index}.description`}
              />
            </div>

            <button
              className="btn btn-primary"
              type="button"
              onClick={() => removeSchool(index)}
            >
              Remove
            </button>
          </div>
        ))}

        {educationFields.length < maxSchools && (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => appendSchool(initialSchool)}
            disabled={!(isDirty && isValid)}
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
