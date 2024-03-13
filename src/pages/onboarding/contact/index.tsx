import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/router"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { MyInput } from "~/components/my-input"
import { Button } from "~/components/ui/button"
import {
  type InsertContactSchema,
  insertContactSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import OnboardingLayout from "../_layout"
import { FormField } from "~/components/ui/form"
import toast from "react-hot-toast"
import { useUser } from "~/utils/useUser"

export default function Contact() {
  return <NameAndContactForm />
}

function NameAndContactForm() {
  const router = useRouter()
  const utils = api.useContext()
  const { id } = useUser()
  const { data: profile, status } = api.profile.read.useQuery(
    { userId: id },
    { enabled: !!id }
  )

  const form = useForm<InsertContactSchema>({
    resolver: zodResolver(insertContactSchema),

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
      toast.error(error.message)
      router.push("/onboarding/contact")
    },

    onSuccess: (data, input) => {
      if (data?.userId) {
        utils.profile.read.setData(
          { userId: data.userId },
          {
            ...data,
            education: [],
            experience: [],
            email: profile?.email,
            contact: {
              linkedIn: input?.linkedIn ?? null,
              location: input.location,
              id: "",
              phone: input?.phone ?? null,
              portfolio: input?.portfolio ?? null,
              profileId: ""
            }
          }
        )
      }
    },

    onMutate: () => router.push("/onboarding/education")
  })

  const onSubmit = (data: InsertContactSchema) => {
    console.log(profile?.id)
    mutate({ ...data, id: profile?.id })
  }

  useEffect(() => {
    setFocus("firstName")
  }, [setFocus])

  return (
    <OnboardingLayout
      form={form}
      handleSubmit={handleSubmit(onSubmit)}
      title="How can employers get in touch with you?"
    >
      <div className="flex gap-2">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <MyInput field={field} label="First Name" required />
          )}
        />
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <MyInput field={field} label="Last Name" required />
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="profession"
        render={({ field }) => (
          <MyInput
            placeholder="Ex: Software Engineer"
            field={field}
            label="Profession"
            required
          />
        )}
      />
      <FormField
        control={form.control}
        name="location"
        render={({ field }) => (
          <MyInput
            placeholder="Ex: Los Angeles, CA"
            field={field}
            label="Location"
            required
          />
        )}
      />
      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => <MyInput field={field} label="Phone" />}
      />

      <div className="flex gap-2">
        <FormField
          control={form.control}
          name="linkedIn"
          render={({ field }) => (
            <MyInput
              placeholder="Ex: https://www.linkedin.com/in/..."
              field={field}
              label="LinkedIn URL"
            />
          )}
        />
        <FormField
          control={form.control}
          name="portfolio"
          render={({ field }) => (
            <MyInput
              placeholder="Ex: https://github.com/galosandoval"
              field={field}
              label="Website URL"
            />
          )}
        />
      </div>

      <div className="flex w-full justify-end">
        <Button loading={status === "loading"} type="submit">
          {status === "loading" ? "Loading..." : "Next: Education"}
        </Button>
      </div>
    </OnboardingLayout>
  )
}
