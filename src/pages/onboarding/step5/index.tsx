import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import {
  type FieldArrayWithId,
  type FieldErrors,
  type UseFieldArrayRemove,
  type UseFormRegister,
  useFieldArray,
  useForm
} from "react-hook-form"
import toast from "react-hot-toast"
import { MyErrorMessage } from "~/components/my-error-message"
import {
  insertSkillsSchema,
  maxSkills,
  type InsertSkillsSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"
import { OnboardingLayout } from "../_layout"
import { Button } from "~/components/ui/button"
import { Cross1Icon } from "@radix-ui/react-icons"
import { TextInput } from "~/components/text-input"

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

    onMutate: () => router.push("/dashboard")
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

  const hasMoreThanOneSkill = fields.length > 1

  return (
    <OnboardingLayout handleSubmit={handleSubmit(onSubmit)} title="Skills">
      {fields.map((field, index) => (
        <SkillForm
          hasMoreThanOneSkill={hasMoreThanOneSkill}
          errors={errors}
          field={field}
          index={index}
          register={register}
          remove={remove}
          key={field.id}
        />
      ))}

      <MyErrorMessage errors={errors} name="skills.root" />

      <div className="ml-auto space-x-2">
        {fields.length < maxSkills && (
          <Button
            variant="ghost"
            type="button"
            onClick={() => append(initialSkills)}
          >
            Add another
          </Button>
        )}

        <Button type="submit">Finish</Button>
      </div>
    </OnboardingLayout>
  )
}

function SkillForm({
  field,
  index,
  errors,
  hasMoreThanOneSkill,
  remove,
  register
}: {
  field: FieldArrayWithId<InsertSkillsSchema>
  index: number
  errors: FieldErrors<InsertSkillsSchema>
  hasMoreThanOneSkill: boolean
  remove: UseFieldArrayRemove
  register: UseFormRegister<InsertSkillsSchema>
}) {
  return (
    <div key={field.id}>
      <div className="flex gap-2">
        <TextInput
          name={`skills.${index}.value`}
          errors={errors}
          label={`Skill ${index + 1}`}
          placeholder="Ex: Customer service"
          register={register}
        />

        {hasMoreThanOneSkill && (
          <Button
            size="icon"
            variant="outline"
            className="self-center justify-self-end text-destructive"
            type="button"
            onClick={() => remove(index)}
          >
            <Cross1Icon />
          </Button>
        )}
      </div>
    </div>
  )
}
