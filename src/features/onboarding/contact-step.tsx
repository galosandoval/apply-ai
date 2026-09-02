"use client"

import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { MyInput } from "~/components/my-input"
import { Button } from "~/components/ui/button"
import {
  type InsertContactSchema,
  insertContactSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import OnboardingFormLayout from "~/features/onboarding/onboarding-form-layout"
import { FormField } from "~/components/ui/form"
import toast from "react-hot-toast"
import { useUser } from "~/utils/useUser"
import { useAppForm } from "~/components/use-app-form"
import { useOnboardingStep } from "~/features/onboarding/use-onboarding-step"
import { useErrorText } from "~/components/use-error-text"

export function ContactStep() {
  return <NameAndContactForm />
}

function NameAndContactForm() {
  const errorText = useErrorText()
  const t = useTranslations("onboarding.contact")
  const { goToStep } = useOnboardingStep()
  const utils = api.useContext()
  const { id } = useUser()
  const { data: profile, status } = api.profile.read.useQuery(undefined, {
    enabled: !!id
  })

  const form = useAppForm(insertContactSchema, {
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      linkedIn: "",
      portfolio: "",
      location: "",
      profession: ""
    },

    values: {
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      phone: profile?.contact?.phone ?? "",
      linkedIn: profile?.contact?.linkedIn ?? "",
      portfolio: profile?.contact?.portfolio ?? "",
      location: profile?.contact?.location ?? "",
      profession: profile?.profession ?? ""
    }
  })

  const { handleSubmit, setFocus } = form

  const { mutate } = api.profile.upsertNameAndContact.useMutation({
    onError: (error) => {
      toast.error(errorText(error))
      goToStep("contact")
    },

    onSuccess: (data, input) => {
      if (!data) return

      // Merge instead of replace — an imported resume's education, experience
      // and skills live in this same cache entry, and the next onboarding
      // steps read them from here.
      utils.profile.read.setData(undefined, (old) => ({
        ...old,
        ...data,
        education: old?.education ?? [],
        experience: old?.experience ?? [],
        skills: old?.skills ?? [],
        contact: {
          linkedIn: input?.linkedIn ?? null,
          location: input.location,
          id: old?.contact?.id ?? "",
          phone: input?.phone ?? null,
          portfolio: input?.portfolio ?? null,
          userId: data.id,
          // The master copy, never a resume's snapshot of it.
          resumeId: null,
          fullName: null,
          email: null
        }
      }))
    },

    onMutate: () => goToStep("education")
  })

  const onSubmit = (data: InsertContactSchema) => {
    mutate(data)
  }

  useEffect(() => {
    setFocus("firstName")
  }, [setFocus])

  return (
    <OnboardingFormLayout
      form={form}
      handleSubmit={handleSubmit(onSubmit)}
      title={t("title")}
    >
      <div className="flex gap-2 max-sm:flex-col">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <MyInput field={field} label={t("firstName")} required />
          )}
        />
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <MyInput field={field} label={t("lastName")} required />
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="profession"
        render={({ field }) => (
          <MyInput
            placeholder={t("professionPlaceholder")}
            field={field}
            label={t("profession")}
            required
          />
        )}
      />
      <FormField
        control={form.control}
        name="location"
        render={({ field }) => (
          <MyInput
            placeholder={t("locationPlaceholder")}
            field={field}
            label={t("location")}
            required
          />
        )}
      />
      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => <MyInput field={field} label={t("phone")} />}
      />

      <div className="flex gap-2 max-sm:flex-col">
        <FormField
          control={form.control}
          name="linkedIn"
          render={({ field }) => (
            <MyInput
              placeholder={t("linkedInPlaceholder")}
              field={field}
              label={t("linkedIn")}
            />
          )}
        />
        <FormField
          control={form.control}
          name="portfolio"
          render={({ field }) => (
            <MyInput
              placeholder={t("websitePlaceholder")}
              field={field}
              label={t("website")}
            />
          )}
        />
      </div>

      <div className="flex w-full justify-end">
        <Button loading={status === "pending"} type="submit">
          {status === "pending" ? t("loading") : t("next")}
        </Button>
      </div>
    </OnboardingFormLayout>
  )
}
