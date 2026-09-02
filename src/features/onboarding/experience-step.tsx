"use client"

import { useTranslations } from "next-intl"
import { Cross1Icon } from "@radix-ui/react-icons"
import { useEffect } from "react"
import {
  type FieldArrayWithId,
  type UseFieldArrayRemove,
  type UseFormWatch,
  useFieldArray,
  type Control
} from "react-hook-form"
import toast from "react-hot-toast"
import { MyAlert } from "~/components/alert"
import { MyErrorMessage } from "~/components/my-error-message"
import { MyInput } from "~/components/my-input"
import { MarkdownField } from "~/components/markdown-field"
import { Button } from "~/components/ui/button"
import {
  insertExperienceSchema,
  type InsertExperienceSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"
import OnboardingFormLayout from "~/features/onboarding/onboarding-form-layout"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "~/components/ui/form"
import { useAppForm } from "~/components/use-app-form"
import { useOnboardingStep } from "~/features/onboarding/use-onboarding-step"
import { useErrorText } from "~/components/use-error-text"

const initialExperience: InsertExperienceSchema["experience"] = [
  {
    name: "",
    body: "",
    startDate: "",
    endDate: "",
    title: ""
  }
]

const maxExperience = 4

export function ExperienceStep() {
  const errorText = useErrorText()
  const t = useTranslations("onboarding.experience")
  const { goToStep } = useOnboardingStep()

  const { id } = useUser()

  const { data: profile } = api.profile.read.useQuery(undefined, {
    enabled: !!id
  })

  const { mutate } = api.profile.addWork.useMutation({
    onError: (error) => {
      toast.error(errorText(error))
      goToStep("experience")
    },

    onMutate: () => goToStep("skills")
  })

  const form = useAppForm(insertExperienceSchema, {
    defaultValues: {
      experience: initialExperience
    },

    values: {
      experience: profile?.experience.length
        ? profile.experience.map((experience) => ({
            id: experience.id,
            name: experience.name,
            body: experience.body,
            startDate: experience.startDate,
            endDate: experience.endDate,
            title: experience.title
          }))
        : initialExperience
    }
  })

  const {
    handleSubmit,
    formState: { errors },
    watch,
    control,
    setFocus
  } = form

  const { fields, append, remove } = useFieldArray({
    name: "experience",
    control
  })

  const onSubmit = (data: InsertExperienceSchema) => {
    mutate({ experience: data.experience })
  }

  useEffect(() => {
    setFocus("experience.0.name")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasMoreThanOneJob = fields.length > 1

  return (
    <OnboardingFormLayout
      form={form}
      title={t("title")}
      handleSubmit={handleSubmit(onSubmit)}
    >
      <h2 className="max-w-md pb-4 text-sm text-muted-foreground">
        Start with your most recent job and work backwards, including the
        company name and location, your title, and how long you worked there.
        Finish by writing 3 to 5 accomplishments for each job.
      </h2>

      {fields.map((field, index) => (
        <ExperienceForm
          field={field}
          hasMoreThanOneJob={hasMoreThanOneJob}
          index={index}
          remove={remove}
          watch={watch}
          key={field.id}
          control={control}
        />
      ))}

      <MyErrorMessage errors={errors} name="experience.root" />

      <div className="ml-auto space-x-2">
        {fields.length < maxExperience && (
          <Button
            variant="ghost"
            type="button"
            onClick={() => append(initialExperience)}
          >
            Add another
          </Button>
        )}

        <Button type="submit">{t("next")}</Button>
      </div>
    </OnboardingFormLayout>
  )
}

function ExperienceForm({
  field,
  watch,
  index,
  hasMoreThanOneJob,
  remove,
  control
}: {
  field: FieldArrayWithId<InsertExperienceSchema>
  watch: UseFormWatch<InsertExperienceSchema>
  index: number
  hasMoreThanOneJob: boolean
  remove: UseFieldArrayRemove
  control: Control<InsertExperienceSchema>
}) {
  const t = useTranslations("onboarding.experience")
  const nameSub = watch(`experience.${index}.name`)

  let fieldTitle = ""
  if (hasMoreThanOneJob) {
    if (nameSub) {
      fieldTitle = nameSub
    } else {
      fieldTitle = `Job ${index + 1}`
    }
  }

  return (
    <div key={field.id} className="flex flex-col gap-2">
      <div className="flex justify-between">
        <h2>{fieldTitle}</h2>

        {hasMoreThanOneJob ? (
          <Button
            type="button"
            variant="outline"
            className="justify-self-end text-destructive"
            size="icon"
            onClick={() => remove(index)}
          >
            <Cross1Icon />
          </Button>
        ) : null}
      </div>

      <FormField
        control={control}
        name={`experience.${index}.name`}
        render={({ field }) => (
          <MyInput
            field={field}
            label={t("company")}
            placeholder={t("companyPlaceholder")}
            required
          />
        )}
      />

      <FormField
        control={control}
        name={`experience.${index}.title`}
        render={({ field }) => (
          <MyInput
            field={field}
            label={t("jobTitle")}
            placeholder={t("jobTitlePlaceholder")}
            required
          />
        )}
      />

      <div className="flex gap-2 max-sm:flex-col">
        <FormField
          control={control}
          name={`experience.${index}.startDate`}
          render={({ field }) => (
            <MyInput
              field={field}
              label={t("startDate")}
              placeholder={t("startDatePlaceholder")}
              required
            />
          )}
        />
        <FormField
          control={control}
          name={`experience.${index}.endDate`}
          render={({ field }) => (
            <MyInput
              field={field}
              label={t("endDate")}
              placeholder={t("endDatePlaceholder")}
              required
            />
          )}
        />
      </div>

      <div>
        {index === 0 && (
          <div className="mt-4">
            <MyAlert
              title={t("accomplishments")}
              description={t("accomplishmentsAdvice")}
            />
          </div>
        )}
      </div>

      <BodyField control={control} index={index} />
    </div>
  )
}

/**
 * The job's body: one field, holding what the resume prints under the job.
 *
 * The same `MarkdownField` the editor's panel uses, so what a user writes here
 * is stored exactly as typed and reads in onboarding the way it will read in
 * the editor. The step used to prefix every filled line with `- ` on blur; a
 * body that is one field precisely so a user may write prose is not a field the
 * form gets to silently rewrite into a list.
 */
function BodyField({
  control,
  index
}: {
  control: Control<InsertExperienceSchema>
  index: number
}) {
  const t = useTranslations("onboarding.experience")

  return (
    <FormField
      control={control}
      name={`experience.${index}.body`}
      render={({ field }) => (
        <FormItem className="w-full">
          <FormLabel htmlFor={field.name}>
            {t("bodyLabel")}
            <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <MarkdownField
              id={field.name}
              onChange={field.onChange}
              onCommit={field.onBlur}
              placeholder={t("accomplishmentsPlaceholder")}
              value={field.value}
            />
          </FormControl>
          <FormDescription>{t("accomplishmentsHint")}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
