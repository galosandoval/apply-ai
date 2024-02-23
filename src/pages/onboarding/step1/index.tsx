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
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

export default function Step1() {
  const router = useRouter()
  const utils = api.useContext()

  const { id } = useUser()

  const { data: profile } = api.profile.read.useQuery(
    { userId: id },
    { enabled: !!id }
  )

  const { mutate } = api.profile.upsertNameAndContact.useMutation({
    onError: (error) => {
      toast.error(error.message)
      router.push("/onboarding/step1")
    },

    onSuccess: (data) => {
      if (data?.userId) {
        utils.profile.read.setData(
          { userId: data.userId },
          { ...data, education: [], experience: [], contact: [] }
        )
      }
    },

    onMutate: () => router.push("/onboarding/step2")
  })

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
      phone: profile?.contact?.[0]?.phone ?? "",
      linkedIn: profile?.contact?.[0]?.linkedIn ?? "",
      portfolio: profile?.contact?.[0]?.portfolio ?? "",
      location: profile?.contact?.[0]?.location ?? ""
    },

    values: {
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      phone: profile?.contact?.[0]?.phone ?? "",
      linkedIn: profile?.contact?.[0]?.linkedIn ?? "",
      portfolio: profile?.contact?.[0]?.portfolio ?? "",
      location: profile?.contact?.[0]?.location ?? ""
    }
  })

  const onSubmit = async (data: InsertNameAndContactSchema) => {
    mutate({ ...data, id: profile?.id })
  }

  useEffect(() => {
    setFocus("firstName")
  }, [setFocus])

  return (
    <main className="grid h-full place-items-center">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <div>
          <TextInput
            label="First Name"
            name="firstName"
            register={register}
            errors={errors}
            required
          />
        </div>
        <div>
          <TextInput
            label="Last Name"
            name="lastName"
            register={register}
            errors={errors}
            required
          />
        </div>
        <div>
          <TextInput
            label="LinkedIn URL"
            name="linkedIn"
            register={register}
            errors={errors}
          />
        </div>
        <div>
          <TextInput
            label="Website URL"
            name="portfolio"
            register={register}
            errors={errors}
          />
        </div>
        <div>
          <TextInput
            label="Phone"
            name="phone"
            register={register}
            errors={errors}
          />
        </div>
        <div>
          <TextInput
            label="Location"
            name="location"
            register={register}
            errors={errors}
            required
            placeholder="Ex: San Francisco, CA"
          />
        </div>
        <div className="flex w-full justify-end">
          <Button>Next</Button>
        </div>
      </form>
    </main>
  )
}
