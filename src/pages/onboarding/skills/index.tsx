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
import Image from "next/image"

const initialSkills: InsertSkillsSchema["skills"] = [
  {
    category: "",
    all: "",
    position: 0
  }
]

export default function Skills() {
  const router = useRouter()
  const { id: userId } = useUser()

  const { data: profile } = api.profile.read.useQuery(
    { userId },
    { enabled: !!userId }
  )

  const { mutate } = api.profile.upsertSkills.useMutation({
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
        ? profile.skills.map((s, i) => ({
            category: s.category ?? "",
            all: s.all?.join(", ") ?? "",
            position: s.position ?? i
          }))
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
    mutate({
      skills: values.skills.map((s, i) => ({
        ...s,
        all: s.all.split(", "),
        position: i
      })),
      profileId: profile?.id!
    })
  }

  useEffect(() => {
    setFocus("skills.0.category")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasMoreThanOneSkill = fields.length > 1

  return (
    <OnboardingLayout
      form={form}
      handleSubmit={handleSubmit(onSubmit)}
      title="Skills"
    >
      <h2 className="max-w-4xl pb-4 text-sm text-muted-foreground">
        This is how your skills will be displayed on your resume. You can add
        several categories and skills. Type in skills and separate them with a
        comma.
      </h2>

      <Image
        src="/skills.png"
        alt="Skills"
        width={768}
        height={100}
        className="rounded"
      />

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

const categoryPlaceholders = [
  "Ex: Soft Skills",
  "Ex: Hard Skills",
  "Ex: Technical Skills",
  "Ex: Frontend",
  "Ex: Backend",
  "Ex: Additional"
]

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
      <div className="grid grid-cols-8 gap-4">
        <div className="col-span-2">
          <FormField
            control={control}
            name={`skills.${index}.category`}
            render={({ field }) => (
              <MyInput
                field={field}
                label={`Category ${index + 1}`}
                placeholder={
                  categoryPlaceholders[index % categoryPlaceholders.length]
                }
              />
            )}
          />
        </div>
        <div className="col-span-6 flex gap-2">
          <FormField
            control={control}
            name={`skills.${index}.all`}
            render={({ field }) => (
              <MyInput
                field={field}
                label="All"
                placeholder="Ex: Customer service, customer support"
              />
            )}
          />

          {hasMoreThanOneSkill && (
            <div className="self-end justify-self-end pb-2">
              <Button
                size="icon"
                variant="outline"
                className="text-destructive"
                type="button"
                onClick={() => remove(index)}
              >
                <Cross1Icon />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
