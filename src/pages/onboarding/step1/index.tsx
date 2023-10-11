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
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full max-w-prose flex-col gap-3"
    >
      <h1>What&rsquo;s your name?</h1>

      {/* TODO: make this div a component */}
      <div className="">
        <label htmlFor="firstName" className="label">
          <span className="label-text">
            First Name<span className="text-error">*</span>
          </span>
        </label>

        <input
          id="firstName"
          type="text"
          className="input input-bordered"
          {...register("firstName")}
        />

        <MyErrorMessage errors={errors} name="firstName" />
      </div>

      <div className="">
        <label htmlFor="lastName" className="label">
          <span className="label-text">
            Last Name<span className="text-error">*</span>
          </span>
        </label>

        <input
          id="lastName"
          type="text"
          className="input input-bordered"
          {...register("lastName")}
        />

        <MyErrorMessage errors={errors} name="lastName" />
      </div>

      <button type="submit" className="btn btn-primary">
        Next
      </button>
    </form>
  )
}
