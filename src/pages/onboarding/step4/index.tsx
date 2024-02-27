import { zodResolver } from "@hookform/resolvers/zod"
import { Cross1Icon } from "@radix-ui/react-icons"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import {
  type FieldArrayWithId,
  type FieldErrors,
  type UseFieldArrayRemove,
  type UseFormRegister,
  type UseFormWatch,
  useFieldArray,
  useForm
} from "react-hook-form"
import toast from "react-hot-toast"
import { MyAlert } from "~/components/alert"
import { MyErrorMessage } from "~/components/my-error-message"
import { TextAreaInput } from "~/components/text-area"
import { TextInput } from "~/components/text-input"
import { Button } from "~/components/ui/button"
import {
  insertExperienceSchema,
  type InsertExperienceSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"
import { OnboardingLayout } from "../_layout"

const initialExperience: InsertExperienceSchema["experience"] = [
  {
    companyName: "",
    description: "",
    startDate: "",
    endDate: "",
    title: ""
  }
]

const maxExperience = 4

export default function Step4() {
  const router = useRouter()

  const { id } = useUser()

  const { data: profile } = api.profile.read.useQuery(
    { userId: id },
    { enabled: !!id }
  )

  const { mutate } = api.profile.addWork.useMutation({
    onError: (error) => {
      toast.error(error.message)
      router.push("/onboarding/step4")
    },

    onMutate: () => router.push("/onboarding/step5")
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    control,
    setFocus
  } = useForm<InsertExperienceSchema>({
    resolver: zodResolver(insertExperienceSchema),

    defaultValues: {
      experience: profile?.experience.length
        ? profile.experience.map((experience) => ({
            companyName: experience.companyName,
            description: experience.description,
            startDate: experience.startDate,
            endDate: experience.endDate,
            title: experience.title
          }))
        : initialExperience
    },

    values: {
      experience: profile?.experience.length
        ? profile.experience.map((experience) => ({
            companyName: experience.companyName,
            description: experience.description,
            startDate: experience.startDate,
            endDate: experience.endDate,
            title: experience.title
          }))
        : initialExperience
    }
  })

  const { fields, append, remove } = useFieldArray({
    name: "experience",
    control
  })

  const onSubmit = async (data: InsertExperienceSchema) => {
    const experienceToSubmit = data.experience.map((experience) => ({
      ...experience,
      profileId: profile?.id
    }))

    mutate({ experience: experienceToSubmit, profileId: profile?.id })
  }

  useEffect(() => {
    setFocus("experience.0.companyName")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasMoreThanOneJob = fields.length > 1

  return (
    <OnboardingLayout title="Experience" handleSubmit={handleSubmit(onSubmit)}>
      {hasMoreThanOneJob && (
        <MyAlert
          title="Note"
          description="Fill in your experience in reverse chronological order"
        />
      )}

      {fields.map((field, index) => (
        <ExperienceForm
          errors={errors}
          field={field}
          hasMoreThanOneJob={hasMoreThanOneJob}
          index={index}
          register={register}
          remove={remove}
          watch={watch}
          key={field.id}
        />
      ))}

      <MyErrorMessage errors={errors} name="experience.root" />

      <div className="ml-auto space-x-2">
        {fields.length < maxExperience && (
          <Button
            variant="ghost"
            type="button"
            onClick={() => append(initialExperience)}
          >
            Add another
          </Button>
        )}

        <Button type="submit">Next</Button>
      </div>
    </OnboardingLayout>
  )
}

function ExperienceForm({
  field,
  watch,
  index,
  errors,
  hasMoreThanOneJob,
  remove,
  register
}: {
  field: FieldArrayWithId<InsertExperienceSchema>
  watch: UseFormWatch<InsertExperienceSchema>
  index: number
  errors: FieldErrors<InsertExperienceSchema>
  hasMoreThanOneJob: boolean
  remove: UseFieldArrayRemove
  register: UseFormRegister<InsertExperienceSchema>
}) {
  const nameSub = watch(`experience.${index}.companyName`)

  let fieldTitle = ""
  if (hasMoreThanOneJob) {
    if (nameSub) {
      fieldTitle = nameSub
    } else {
      fieldTitle = `Job ${index + 1}`
    }
  }

  return (
    <div key={field.id} className="flex flex-col gap-2">
      <div>
        <div className="grid grid-cols-3 place-items-center">
          <div></div>

          <h2>{fieldTitle}</h2>

          {hasMoreThanOneJob ? (
            <Button
              type="button"
              variant="outline"
              className="justify-self-end text-destructive"
              size="icon"
              onClick={() => remove(index)}
            >
              <Cross1Icon />
            </Button>
          ) : null}
        </div>

        <TextInput
          name={`experience.${index}.companyName`}
          errors={errors}
          label="Company Name"
          placeholder="Ex: Google"
          register={register}
          required
        />
      </div>

      <TextInput
        name={`experience.${index}.title`}
        errors={errors}
        label="Title"
        register={register}
        placeholder="Ex: Software Engineer"
        required
      />

      <div className="flex gap-2">
        <TextInput
          name={`experience.${index}.startDate`}
          errors={errors}
          label="Start"
          register={register}
          required
          placeholder="Ex: Sept 2017"
        />

        <TextInput
          name={`experience.${index}.endDate`}
          errors={errors}
          label="End"
          register={register}
          placeholder="Ex: May 2021"
          required
        />
      </div>

      <div className="mx-auto max-w-sm">
        <MyAlert
          title="Accomplishments"
          description={`Write a paragraph with 3 to 5 sentences, each sentence should be an accomplishment. Be concise and try to use numbers and percentages in your accomplishments. Each sentence will be a bullet point on your resume.`}
        />
      </div>

      <TextAreaInput
        name={`experience.${index}.description`}
        errors={errors}
        label="Write 3 to 5 accomplishments"
        placeholder="Collaborated closely with cross-functional teams to ensure seamless integration of new features and improvements..."
        register={register}
        required
      />
    </div>
  )
}
