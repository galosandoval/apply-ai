import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { MyErrorMessage } from "~/components/my-error-message"
import { updateProfileSchema } from "~/server/db/crud-schema"
import { api } from "~/utils/api"

export default function Step2() {
  const router = useRouter()

  const handleChangeStep = () => {
    router.push("/onboarding/step3")
  }

  const { mutate } = api.profile.update.useMutation({
    onError: (error) => {
      toast.error(error.message)
      router.push("/onboarding/step2")
    }
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus
  } = useForm<updateProfileSchema>({
    resolver: zodResolver(updateProfileSchema)
  })

  const onSubmit = async (data: updateProfileSchema) => {
    mutate(data)
    handleChangeStep()
  }
  useEffect(() => {
    setFocus("profession")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full max-w-prose flex-col gap-3"
    >
      <div className="">
        <label htmlFor="profession" className="label">
          <span className="label-text">
            Title<span className="text-error">*</span>
          </span>
        </label>

        <input
          id="profession"
          type="text"
          placeholder="Ex: Full Stack Developer"
          className="rounded-sm px-2 py-1"
          {...register("profession")}
        />
        <MyErrorMessage errors={errors} name="profession" />
      </div>

      <div className="">
        <label htmlFor="profession" className="label">
          <span className="label-text">
            About Me<span className="text-error">*</span>
          </span>
        </label>

        <textarea
          placeholder="Ex: I am a full stack developer with 5 years of experience. I have worked with ..."
          className="rounded-sm px-2 py-1"
          {...register("introduction")}
        ></textarea>

        <MyErrorMessage errors={errors} name="introduction" />
      </div>

      <div className="">
        <label htmlFor="interests" className="label">
          <span className="label-text">
            Interests<span className="text-error">*</span>
          </span>
        </label>

        <textarea
          id="interests"
          placeholder="Ex: I like to go hiking, biking, and swimming."
          className="rounded-sm px-2 py-1"
          {...register("interests")}
        ></textarea>
        <MyErrorMessage errors={errors} name="interests" />
      </div>

      <button type="submit" className="btn btn-primary">
        Next
      </button>
    </form>
  )
}
