import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { MyErrorMessage } from "~/components/my-error-message"
import {
  insertSkillsSchema,
  maxSkills,
  type InsertSkillsSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

const initialSkills: InsertSkillsSchema["skills"] = [
  {
    value: ""
  }
]

export default function Step5() {
  const router = useRouter()
  const { id: userId } = useUser()

  const { data: profile } = api.profile.read.useQuery(
    { userId },
    { enabled: !!userId }
  )

  const { mutate } = api.profile.addSkills.useMutation({
    onError: (error) => {
      toast.error(error.message)
      router.push("/onboarding/step4")
    },

    onMutate: () => router.push("/onboarding/step6")
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setFocus
  } = useForm<InsertSkillsSchema>({
    resolver: zodResolver(insertSkillsSchema),
    defaultValues: {
      skills: profile?.skills?.length
        ? profile.skills.map((s) => ({ value: s }))
        : initialSkills
    },

    values: {
      skills: profile?.skills?.length
        ? profile.skills.map((s) => ({ value: s }))
        : initialSkills
    }
  })

  const { fields, append, remove } = useFieldArray({
    name: "skills",
    control
  })

  const onSubmit = (values: InsertSkillsSchema) => {
    mutate({ skills: values.skills, userId })
  }

  useEffect(() => {
    setFocus("skills.0.value")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <h1 className="mx-auto">Skills</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-full max-w-prose flex-col gap-3"
      >
        <div className="">
          {fields.map((field, index) => (
            <div key={field.id}>
              <div className="">
                <label htmlFor={`skills.${index}.value`} className="label">
                  <span className="label-text">
                    Skill {index + 1}
                    <span className="text-error">*</span>
                  </span>
                </label>

                <input
                  {...register(`skills.${index}.value`)}
                  type="text"
                  placeholder="Ex: Customer service"
                  className="rounded-sm px-2 py-1"
                />

                <MyErrorMessage
                  errors={errors}
                  name={`skills.${index}.value`}
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

          <MyErrorMessage errors={errors} name="skills.root" />

          {fields.length < maxSkills && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => append(initialSkills)}
            >
              Add another
            </button>
          )}

          <button className="btn btn-primary" type="submit">
            Next
          </button>
        </div>
      </form>
    </>
  )
}
