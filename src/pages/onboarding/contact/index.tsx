import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { NewTextInput } from "~/components/text-input"
import { Button } from "~/components/ui/button"
import {
  type InsertUserSchema,
  insertUserSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import OnboardingLayout from "../_layout"
import { FormField } from "~/components/ui/form"
import toast from "react-hot-toast"

export default function Contact() {
  // const { id } = useUser()

  // const { data: profile, status } = api.profile.read.useQuery(
  //   { userId: id },
  //   { enabled: !!id }
  // )

  return <NameAndContactForm />
}

function NameAndContactForm() {
  const router = useRouter()

  const form = useForm<InsertUserSchema>({
    resolver: zodResolver(insertUserSchema),

    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      linkedIn: "",
      portfolio: "",
      location: "",
      profession: "",
      password: "",
      confirm: ""
    }
  })

  const {
    handleSubmit,
    setFocus,
    formState: { errors }
  } = form

  console.log(errors)

  const { mutate } = api.user.create.useMutation({
    onError: (error) => {
      toast.error(error.message)
    }
  })

  // const { mutate } = api.profile.upsertNameAndContact.useMutation({
  //   onError: (error) => {
  //     toast.error(error.message)
  //     router.push("/onboarding/step1")
  //   },

  //   onSuccess: (data, input) => {
  //     if (data?.userId) {
  //       utils.profile.read.setData(
  //         { userId: data.userId },
  //         {
  //           ...data,
  //           education: [],
  //           experience: [],
  //           email: profile.email,
  //           contact: {
  //             linkedIn: input?.linkedIn ?? null,
  //             location: input.location,
  //             id: "",
  //             phone: input?.phone ?? null,
  //             portfolio: input?.portfolio ?? null,
  //             profileId: ""
  //           }
  //         }
  //       )
  //     }
  //   },

  //   onMutate: () => router.push("/onboarding/step2")
  // })

  const onSubmit = async (data: InsertUserSchema) => {
    mutate(data)
    console.log(data)
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
            <NewTextInput field={field} label="First Name" required />
          )}
        />
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <NewTextInput field={field} label="Last Name" required />
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="profession"
        render={({ field }) => (
          <NewTextInput
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
          <NewTextInput
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
        render={({ field }) => <NewTextInput field={field} label="Phone" />}
      />

      <div className="flex gap-2">
        <FormField
          control={form.control}
          name="linkedIn"
          render={({ field }) => (
            <NewTextInput
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
            <NewTextInput
              placeholder="Ex: https://github.com/galosandoval"
              field={field}
              label="Website URL"
            />
          )}
        />
      </div>

      <h2 className="pt-4 text-lg">Create your profile</h2>

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <NewTextInput field={field} label="Email" required />
        )}
      />
      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <NewTextInput
            type="password"
            field={field}
            label="Password"
            required
          />
        )}
      />
      <FormField
        control={form.control}
        name="confirm"
        render={({ field }) => (
          <NewTextInput
            type="password"
            field={field}
            label="Confirm Password"
            required
          />
        )}
      />

      <div className="flex w-full justify-end">
        <Button type="submit">Next</Button>
      </div>
    </OnboardingLayout>
  )
}
