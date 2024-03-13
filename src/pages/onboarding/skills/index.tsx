import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import {
  type FieldArrayWithId,
  type UseFieldArrayRemove,
  useFieldArray,
  useForm,
  type Control
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
import { Button } from "~/components/ui/button"
import { Cross1Icon } from "@radix-ui/react-icons"
import { MyInput } from "~/components/my-input"
import OnboardingLayout from "../_layout"
import { FormField } from "~/components/ui/form"

const initialSkills: InsertSkillsSchema["skills"] = [
  {
    value: ""
  }
]

export default function Skills() {
  const router = useRouter()
  const { id: userId } = useUser()

  const { data: profile } = api.profile.read.useQuery(
    { userId },
    { enabled: !!userId }
  )

  const { mutate } = api.profile.addSkills.useMutation({
    onError: (error) => {
      toast.error(error.message)
      router.push("/onboarding/skills")
    },

    onMutate: () => router.push("/dashboard")
  })

  const form = useForm<InsertSkillsSchema>({
    resolver: zodResolver(insertSkillsSchema),
    defaultValues: {
      skills: initialSkills
    },

    values: {
      skills: profile?.skills?.length
        ? profile.skills.map((s) => ({ value: s }))
        : initialSkills
    }
  })

  const {
    handleSubmit,
    formState: { errors },
    control,
    setFocus
  } = form

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
    <OnboardingLayout
      form={form}
      handleSubmit={handleSubmit(onSubmit)}
      title="Skills"
    >
      <h2 className="max-w-md pb-4 text-sm text-muted-foreground">
        Add a few skills to show employers you&apos;re good in your field.
      </h2>

      {fields.map((field, index) => (
        <SkillForm
          hasMoreThanOneSkill={hasMoreThanOneSkill}
          field={field}
          index={index}
          remove={remove}
          control={control}
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

        <Button type="submit">Done: Start generating resumes</Button>
      </div>
    </OnboardingLayout>
  )
}

function SkillForm({
  field,
  index,
  hasMoreThanOneSkill,
  remove,
  control
}: {
  field: FieldArrayWithId<InsertSkillsSchema>
  index: number
  hasMoreThanOneSkill: boolean
  remove: UseFieldArrayRemove
  control: Control<InsertSkillsSchema>
}) {
  return (
    <div key={field.id}>
      <div className="flex gap-2">
        <FormField
          control={control}
          name={`skills.${index}.value`}
          render={({ field }) => (
            <MyInput
              field={field}
              label={`Skill ${index + 1}`}
              placeholder="Ex: Customer service"
            />
          )}
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
