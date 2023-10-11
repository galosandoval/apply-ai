import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { MyErrorMessage } from "~/components/my-error-message"
import {
  type InsertNameSchema,
  insertNameSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

import NameInput from "~/components/name-input"

export default function Step1() {
  const router = useRouter()
  const utils = api.useContext()

  const { id } = useUser()

  const { data: profile } = api.profile.read.useQuery(
    { userId: id },
    { enabled: !!id }
  )

  const { mutate } = api.profile.upsertName.useMutation({
    onError: (error) => {
      toast.error(error.message)
      router.push("/onboarding/step1")
    },

    onSuccess: (data) => {
      if (data?.userId) {
        utils.profile.read.setData(
          { userId: data.userId },
          { ...data, education: [], experience: [] }
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
  } = useForm<InsertNameSchema>({
    resolver: zodResolver(insertNameSchema),

    defaultValues: {
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? ""
    },

    values: {
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? ""
    }
  })

  const onSubmit = async (data: InsertNameSchema) => {
    mutate({ ...data, id: profile?.id })
  }

  useEffect(() => {
    setFocus("firstName")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (

    <form onSubmit={handleSubmit(onSubmit)} className="">
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3">
      <div>
        <NameInput
          label="First Name"
          name="firstName"
          register={register}
          errors={errors}
        />
        <MyErrorMessage errors={errors} name="firstName" />
      </div>
      <div>
        <NameInput
          label="Last Name"
          name="lastName"
          register={register}
          errors={errors}
        />
        <MyErrorMessage errors={errors} name="lastName" />
      </div>

      <button type="submit" className="btn btn-primary mt-6 w-[200px]">
        Next
      </button>
    </div>
  </form>
  )
}