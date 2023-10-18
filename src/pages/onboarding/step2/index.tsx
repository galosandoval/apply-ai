import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { MyErrorMessage } from "~/components/my-error-message"
import { TextAreaInput } from "~/components/text-field"
import { TextInput } from "~/components/text-input"
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
      introduction: profile?.introduction ?? "",
      interests: profile?.interests ?? ""
    },
    values: {
      profession: profile?.profession ?? "",
      introduction: profile?.introduction ?? "",
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
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="min-h-screen flex flex-col gap-3 justify-center items-center"
    >
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
        label="About Me"
        name="introduction"
        register={register}
        placeholder="Ex: I am a full stack developer with 5 years of experience. I have worked with ..."
      />
      <TextAreaInput
        errors={errors}
        label="Interests"
        name="interests"
        register={register}
        placeholder="I like turtles"
      />

      <button type="submit" className="btn btn-primary">
        Next
      </button>
    </form>
  )
}
