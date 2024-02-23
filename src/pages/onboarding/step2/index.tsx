import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { TextAreaInput } from "~/components/text-area"
import { TextInput } from "~/components/text-input"
import { Button } from "~/components/ui/button"
import {
  type UpdateProfileSchema,
  updateProfileSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

export default function Step2() {
  const router = useRouter()

  const { id } = useUser()

  const { data: profile } = api.profile.read.useQuery(
    { userId: id },
    { enabled: !!id }
  )

  const { mutate } = api.profile.update.useMutation({
    onError: (error) => {
      toast.error(error.message)
      router.push("/onboarding/step2")
    },

    onMutate: () => router.push("/onboarding/step3")
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus
  } = useForm<UpdateProfileSchema>({
    resolver: zodResolver(updateProfileSchema),

    defaultValues: {
      profession: profile?.profession ?? "",
      interests: profile?.interests ?? ""
    },
    values: {
      profession: profile?.profession ?? "",
      interests: profile?.interests ?? ""
    }
  })

  const onSubmit = async (data: UpdateProfileSchema) => {
    mutate(data)
  }

  useEffect(() => {
    setFocus("profession")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="grid h-full place-items-center">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <h1>Tell us about yourself</h1>

        <TextInput
          placeholder="Ex: Full Stack Developer"
          errors={errors}
          label="Title"
          name="profession"
          register={register}
          required
        />

        <TextAreaInput
          errors={errors}
          label="Interests"
          name="interests"
          register={register}
          placeholder="Ex: I like hiking, swimming, and reading fantasy novels."
        />
        <div className="flex w-full justify-end">
          <Button type="submit">Next</Button>
        </div>
      </form>
    </main>
  )
}
