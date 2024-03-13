import { zodResolver } from "@hookform/resolvers/zod"
import { Cross1Icon } from "@radix-ui/react-icons"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import {
  type FieldArrayWithId,
  type UseFieldArrayRemove,
  type UseFormWatch,
  useFieldArray,
  useForm,
  type Control
} from "react-hook-form"
import toast from "react-hot-toast"
import { MyAlert } from "~/components/alert"
import { MyErrorMessage } from "~/components/my-error-message"
import { MyTextarea } from "~/components/my-textarea"
import { MyInput } from "~/components/my-input"
import { Button } from "~/components/ui/button"
import {
  insertExperienceSchema,
  type InsertExperienceSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"
import OnboardingLayout from "../_layout"
import { FormField } from "~/components/ui/form"

const initialExperience: InsertExperienceSchema["experience"] = [
  {
    name: "",
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
      router.push("/onboarding/experience")
    },

    onMutate: () => router.push("/onboarding/skills")
  })

  const form = useForm<InsertExperienceSchema>({
    resolver: zodResolver(insertExperienceSchema),

    defaultValues: {
      experience: initialExperience
    },

    values: {
      experience: profile?.experience.length
        ? profile.experience.map((experience) => ({
            name: experience.name,
            description: experience.description,
            startDate: experience.startDate,
            endDate: experience.endDate,
            title: experience.title
          }))
        : initialExperience
    }
  })

  const {
    handleSubmit,
    formState: { errors },
    watch,
    control,
    setFocus
  } = form

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
    setFocus("experience.0.name")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasMoreThanOneJob = fields.length > 1

  return (
    <OnboardingLayout
      form={form}
      title="Experience"
      handleSubmit={handleSubmit(onSubmit)}
    >
      <h2 className="max-w-md pb-4 text-sm text-muted-foreground">
        Start with your most recent job and work backwards, including the
        company name and location, your title, and how long you worked there.
        Finish by writing 3 to 5 accomplishments for each job.
      </h2>

      {fields.map((field, index) => (
        <ExperienceForm
          field={field}
          hasMoreThanOneJob={hasMoreThanOneJob}
          index={index}
          remove={remove}
          watch={watch}
          key={field.id}
          control={control}
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

        <Button type="submit">Next: Skills</Button>
      </div>
    </OnboardingLayout>
  )
}

function ExperienceForm({
  field,
  watch,
  index,
  hasMoreThanOneJob,
  remove,
  control
}: {
  field: FieldArrayWithId<InsertExperienceSchema>
  watch: UseFormWatch<InsertExperienceSchema>
  index: number
  hasMoreThanOneJob: boolean
  remove: UseFieldArrayRemove
  control: Control<InsertExperienceSchema>
}) {
  const nameSub = watch(`experience.${index}.name`)

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
      <div className="flex justify-between">
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

      <FormField
        control={control}
        name={`experience.${index}.name`}
        render={({ field }) => (
          <MyInput
            field={field}
            label="Company Name"
            placeholder="Ex: Google"
            required
          />
        )}
      />

      <FormField
        control={control}
        name={`experience.${index}.title`}
        render={({ field }) => (
          <MyInput
            field={field}
            label="Title"
            placeholder="Ex: Software Engineer"
            required
          />
        )}
      />

      <div className="flex gap-2">
        <FormField
          control={control}
          name={`experience.${index}.startDate`}
          render={({ field }) => (
            <MyInput
              field={field}
              label="Start Date"
              placeholder="Ex: Sept 2017"
              required
            />
          )}
        />
        <FormField
          control={control}
          name={`experience.${index}.endDate`}
          render={({ field }) => (
            <MyInput
              field={field}
              label="End Date"
              placeholder="Ex: May 2021"
              required
            />
          )}
        />
      </div>

      <div className="mx-auto max-w-md">
        {index === 0 && (
          <div className="mt-4">
            <MyAlert
              title="Accomplishments"
              description={`Write a paragraph with 3 to 5 sentences, each sentence should be an accomplishment. Be concise and try to use numbers and percentages in your accomplishments. Each sentence will be a bullet point on your resume.`}
            />
          </div>
        )}
      </div>

      <FormField
        control={control}
        name={`experience.${index}.description`}
        render={({ field }) => (
          <MyTextarea
            field={field}
            label="Write 3 to 5 accomplishments"
            placeholder="Collaborated closely with cross-functional teams to ensure seamless integration of new features and improvements..."
            required
          />
        )}
      />
    </div>
  )
}
