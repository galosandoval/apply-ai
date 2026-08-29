"use client"

import { useTranslations } from "next-intl"
import { Cross1Icon } from "@radix-ui/react-icons"
import { useEffect } from "react"
import {
  type UseFieldArrayRemove,
  type UseFormWatch,
  useFieldArray,
  type Control
} from "react-hook-form"
import toast from "react-hot-toast"
import { MyErrorMessage } from "~/components/my-error-message"
import { MyTextarea } from "~/components/my-textarea"
import { MyInput } from "~/components/my-input"
import { Button } from "~/components/ui/button"
import {
  insertEducationSchema,
  type InsertEducationSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"
import OnboardingFormLayout from "~/features/onboarding/onboarding-form-layout"
import { FormField } from "~/components/ui/form"
import { useAppForm } from "~/components/use-app-form"
import { useOnboardingStep } from "~/features/onboarding/use-onboarding-step"

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

export function EducationStep() {
  const t = useTranslations("onboarding.education")
  const { goToStep } = useOnboardingStep()
  const { id } = useUser()

  const { data: profile } = api.profile.read.useQuery(undefined, {
    enabled: !!id
  })

  const { mutate } = api.profile.addEducation.useMutation({
    onError: (error) => {
      toast.error(error.message)
      goToStep("education")
    },

    onMutate: () => goToStep("experience")
  })

  const form = useAppForm(insertEducationSchema, {
    defaultValues: {
      education: profile?.education.length
        ? profile.education.map((school) => ({
            id: school.id,
            degree: school.degree,
            endDate: school.endDate,
            name: school.name,
            startDate: school.startDate,
            description: school.description,
            gpa: school.gpa,
            location: school.location
          }))
        : initialSchool
    },

    values: {
      education: profile?.education.length
        ? profile.education.map((school) => ({
            id: school.id,
            degree: school.degree,
            endDate: school.endDate,
            name: school.name,
            startDate: school.startDate,
            description: school.description,
            gpa: school.gpa,
            location: school.location
          }))
        : initialSchool
    }
  })

  const {
    handleSubmit,
    formState: { errors },
    control,
    setFocus,
    watch
  } = form

  const { fields, append, remove } = useFieldArray({
    name: "education",
    control
  })

  const onSubmit = (data: InsertEducationSchema) => {
    mutate({ education: data.education })
  }

  const hasMoreThanOneSchool = fields.length > 1

  useEffect(() => {
    setFocus("education.0.name")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <OnboardingFormLayout
      form={form}
      handleSubmit={handleSubmit(onSubmit)}
      title={t("title")}
    >
      <h2 className="max-w-md pb-4 text-sm text-muted-foreground">
        Start with your most recent education and work backwards, including the
        degree/certification, institution&apos;s name and location, and year of
        completion.
      </h2>

      {fields.map((field, index) => (
        <EducationForm
          control={control}
          watch={watch}
          index={index}
          showTitle={hasMoreThanOneSchool}
          remove={remove}
          key={field.id}
        />
      ))}

      {/*
        Removing the last school is allowed, so this is a state the user can
        reach on purpose — it says so rather than looking like a form that
        failed to load.
      */}
      {fields.length === 0 ? (
        <p className="max-w-md text-sm text-muted-foreground">
          Nothing here yet. If you have no education to list, carry on — this
          step is optional.
        </p>
      ) : null}

      <MyErrorMessage errors={errors} name="education.root" />

      <div className="ml-auto space-x-2">
        {fields.length < maxSchools && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => append(initialSchool)}
          >
            {fields.length === 0 ? t("addFirst") : t("addAnother")}
          </Button>
        )}

        <Button type="submit">{t("next")}</Button>
      </div>
    </OnboardingFormLayout>
  )
}

function EducationForm({
  watch,
  index,
  showTitle,
  remove,
  control
}: {
  watch: UseFormWatch<InsertEducationSchema>
  index: number
  /** One school needs no heading to tell it from the others. */
  showTitle: boolean
  remove: UseFieldArrayRemove
  control: Control<InsertEducationSchema>
}) {
  const t = useTranslations("onboarding.education")
  const nameSub = watch(`education.${index}.name`)

  let fieldTitle = ""
  if (showTitle) {
    if (nameSub) {
      fieldTitle = nameSub
    } else {
      fieldTitle = `School ${index + 1}`
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between">
        <h2>{fieldTitle}</h2>

        {/*
          Always removable, the last one included: a user with no degree has to
          be able to empty this step rather than invent a school to leave it.
        */}
        <Button
          variant="outline"
          type="button"
          className="justify-self-end text-destructive"
          size="icon"
          onClick={() => remove(index)}
        >
          <Cross1Icon />
        </Button>
      </div>

      <FormField
        control={control}
        name={`education.${index}.name`}
        render={({ field }) => (
          <MyInput
            field={field}
            label={t("institution")}
            placeholder={t("institutionPlaceholder")}
            required
          />
        )}
      />

      <div className="flex gap-2 max-sm:flex-col">
        <FormField
          control={control}
          name={`education.${index}.startDate`}
          render={({ field }) => (
            <MyInput
              field={field}
              label={t("start")}
              placeholder={t("startPlaceholder")}
              required
            />
          )}
        />
        <FormField
          control={control}
          name={`education.${index}.endDate`}
          render={({ field }) => (
            <MyInput
              field={field}
              label={t("end")}
              placeholder={t("endPlaceholder")}
              required
            />
          )}
        />
      </div>

      <FormField
        control={control}
        name={`education.${index}.degree`}
        render={({ field }) => (
          <MyInput
            field={field}
            label={t("degree")}
            placeholder={t("degreePlaceholder")}
            required
          />
        )}
      />

      <FormField
        control={control}
        name={`education.${index}.location`}
        render={({ field }) => (
          <MyInput
            field={field}
            label={t("location")}
            placeholder={t("locationPlaceholder")}
          />
        )}
      />

      <FormField
        control={control}
        name={`education.${index}.gpa`}
        render={({ field }) => (
          <MyInput
            field={field}
            label={t("gpa")}
            placeholder={t("gpaPlaceholder")}
          />
        )}
      />

      <FormField
        control={control}
        name={`education.${index}.description`}
        render={({ field }) => (
          <MyTextarea
            field={field}
            label={t("extra")}
            placeholder={t("extraPlaceholder")}
          />
        )}
      />
    </div>
  )
}
