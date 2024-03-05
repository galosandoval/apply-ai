import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { TextInput } from "~/components/text-input"
import { Button } from "~/components/ui/button"
import {
  type InsertNameAndContactSchema,
  insertNameAndContactSchema
} from "~/server/db/crud-schema"
import { type RouterOutputs, api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

export default function Step1() {
  const { id } = useUser()

  const { data: profile, status } = api.profile.read.useQuery(
    { userId: id },
    { enabled: !!id }
  )

  console.log(profile)

  if (status === "success") {
    return <NameAndContactForm profile={profile} />
  }

  if (status === "error") {
    return <p>SOmething went wrong</p>
  }

  return <p className="">loading</p>
}

function NameAndContactForm({
  profile
}: {
  profile: RouterOutputs["profile"]["read"]
}) {
  const router = useRouter()
  const utils = api.useContext()
  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus
  } = useForm<InsertNameAndContactSchema>({
    resolver: zodResolver(insertNameAndContactSchema),

    defaultValues: {
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      phone: profile?.contact?.phone ?? "",
      linkedIn: profile?.contact?.linkedIn ?? "",
      portfolio: profile?.contact?.portfolio ?? "",
      location: profile?.contact?.location ?? ""
    },

    values: {
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      phone: profile?.contact?.phone ?? "",
      linkedIn: profile?.contact?.linkedIn ?? "",
      portfolio: profile?.contact?.portfolio ?? "",
      location: profile?.contact?.location ?? "",
      id: profile.id
    }
  })

  const { mutate } = api.profile.upsertNameAndContact.useMutation({
    onError: (error) => {
      toast.error(error.message)
      router.push("/onboarding/step1")
    },

    onSuccess: (data, input) => {
      if (data?.userId) {
        utils.profile.read.setData(
          { userId: data.userId },
          {
            ...data,
            education: [],
            experience: [],
            email: profile.email,
            contact: {
              linkedIn: input.linkedIn,
              location: input.location,
              id: "",
              phone: input.phone,
              portfolio: input.portfolio,
              profileId: ""
            }
          }
        )
      }
    },

    onMutate: () => router.push("/onboarding/step2")
  })

  const onSubmit = async (data: InsertNameAndContactSchema) => {
    mutate({ ...data, id: profile.id })
  }

  useEffect(() => {
    setFocus("firstName")
  }, [setFocus])

  return (
    <main className="grid h-full place-items-center">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <TextInput
          label="First Name"
          name="firstName"
          register={register}
          errors={errors}
          required
        />

        <TextInput
          label="Last Name"
          name="lastName"
          register={register}
          errors={errors}
          required
        />

        <TextInput
          label="LinkedIn URL"
          name="linkedIn"
          register={register}
          errors={errors}
        />

        <TextInput
          label="Website URL"
          name="portfolio"
          register={register}
          errors={errors}
        />

        <TextInput
          label="Phone"
          name="phone"
          register={register}
          errors={errors}
        />

        <TextInput
          label="Location"
          name="location"
          register={register}
          errors={errors}
          required
          placeholder="Ex: San Francisco, CA"
        />

        <div className="flex w-full justify-end">
          <Button>Next</Button>
        </div>
      </form>
    </main>
  )
}
