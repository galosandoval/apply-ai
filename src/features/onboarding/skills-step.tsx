"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "~/i18n/navigation"
import { useEffect } from "react"
import {
  type FieldArrayWithId,
  type UseFieldArrayRemove,
  useFieldArray,
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
import OnboardingFormLayout from "~/features/onboarding/onboarding-form-layout"
import { FormField } from "~/components/ui/form"
import Image from "next/image"
import { useAppForm } from "~/components/use-app-form"
import { useOnboardingStep } from "~/features/onboarding/use-onboarding-step"
import { appPath } from "~/lib/path"
import { useErrorText } from "~/components/use-error-text"

const initialSkills: InsertSkillsSchema["skills"] = [
  {
    category: "",
    all: "",
    position: 0
  }
]

export function SkillsStep() {
  const errorText = useErrorText()
  const t = useTranslations("onboarding.skills")
  const router = useRouter()
  const { goToStep } = useOnboardingStep()
  const { id: userId } = useUser()

  const { data: profile } = api.profile.read.useQuery(undefined, {
    enabled: !!userId
  })

  const { mutate } = api.profile.upsertSkills.useMutation({
    onError: (error) => {
      toast.error(errorText(error))
      goToStep("skills")
    },

    onMutate: () => router.push(appPath.dashboard)
  })

  const form = useAppForm(insertSkillsSchema, {
    defaultValues: {
      skills: initialSkills
    },

    values: {
      skills: profile?.skills?.length
        ? profile.skills.map((s, i) => ({
            id: s.id,
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
      }))
    })
  }

  useEffect(() => {
    setFocus("skills.0.category")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasMoreThanOneSkill = fields.length > 1

  return (
    <OnboardingFormLayout
      form={form}
      handleSubmit={handleSubmit(onSubmit)}
      title={t("title")}
    >
      <h2 className="max-w-md pb-4 text-sm text-muted-foreground">
        This is how your skills will be displayed on your resume. You can add
        several categories and skills. Type in skills and separate them with a
        comma.
      </h2>

      <Image
        src="/skills.png"
        alt={t("imageAlt")}
        width={768}
        height={100}
        className="h-auto w-full rounded"
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

        <Button type="submit">{t("done")}</Button>
      </div>
    </OnboardingFormLayout>
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
  const t = useTranslations("onboarding.skills")

  return (
    <div key={field.id}>
      <div className="grid grid-cols-8 gap-4 max-md:grid-cols-1 max-md:gap-2">
        <div className="col-span-2 max-md:col-span-1">
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
        <div className="col-span-6 flex gap-2 max-md:col-span-1">
          <FormField
            control={control}
            name={`skills.${index}.all`}
            render={({ field }) => (
              <MyInput
                field={field}
                label={t("all")}
                placeholder={t("allPlaceholder")}
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
