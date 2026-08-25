"use client"

import { Cross1Icon } from "@radix-ui/react-icons"
import { useEffect } from "react"
import {
  type FieldArrayWithId,
  type UseFieldArrayRemove,
  type UseFormWatch,
  useFieldArray,
  type Control
} from "react-hook-form"
import toast from "react-hot-toast"
import { MyAlert } from "~/components/alert"
import { MyErrorMessage } from "~/components/my-error-message"
import { MyInput } from "~/components/my-input"
import { Textarea } from "~/components/ui/textarea"
import { Button } from "~/components/ui/button"
import {
  insertExperienceSchema,
  type InsertExperienceSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"
import OnboardingFormLayout from "~/features/onboarding/onboarding-form-layout"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "~/components/ui/form"
import { useAppForm } from "~/components/use-app-form"
import { useOnboardingStep } from "~/features/onboarding/use-onboarding-step"

const initialExperience: InsertExperienceSchema["experience"] = [
  {
    name: "",
    bullets: [],
    startDate: "",
    endDate: "",
    title: ""
  }
]

/**
 * Bullets are stored as an array but collected as one textarea, so a line is a
 * bullet. Blank lines survive `toBullets` on purpose: stripping them as the user
 * types would swallow the newline they just pressed. `onSubmit` drops them.
 */
const toBullets = (text: string) => text.split("\n")

const fromBullets = (bullets: string[]) => bullets.join("\n")

const maxExperience = 4

export function ExperienceStep() {
  const { goToStep } = useOnboardingStep()

  const { id } = useUser()

  const { data: profile } = api.profile.read.useQuery(undefined, { enabled: !!id })

  const { mutate } = api.profile.addWork.useMutation({
    onError: (error) => {
      toast.error(error.message)
      goToStep("experience")
    },

    onMutate: () => goToStep("skills")
  })

  const form = useAppForm(insertExperienceSchema, {
    defaultValues: {
      experience: initialExperience
    },

    values: {
      experience: profile?.experience.length
        ? profile.experience.map((experience) => ({
          id: experience.id,
          name: experience.name,
          bullets: experience.bullets,
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

  const onSubmit = (data: InsertExperienceSchema) => {
    const experienceToSubmit = data.experience.map((experience) => ({
      ...experience,
      bullets: experience.bullets
        .map((bullet) => bullet.trim())
        .filter(Boolean)
    }))

    mutate({ experience: experienceToSubmit })
  }

  useEffect(() => {
    setFocus("experience.0.name")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasMoreThanOneJob = fields.length > 1

  return (
    <OnboardingFormLayout
      form={form}
      title="Experience"
      handleSubmit={handleSubmit(onSubmit)}
    >
      <h2 className="max-w-md pb-4 text-sm text-muted-foreground">
        Start with your most recent job and work backwards, including the
        company name and location, your title, and how long you worked there.
        Finish by writing 3 to 5 accomplishments for each job, one per line.
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
    </OnboardingFormLayout>
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

      <div className="flex gap-2 max-sm:flex-col">
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

      <div>
        {index === 0 && (
          <div className="mt-4">
            <MyAlert
              title="Accomplishments"
              description={`Write 3 to 5 accomplishments, one per line. Be concise and try to use numbers and percentages. Each line becomes a bullet point on your resume.`}
            />
          </div>
        )}
      </div>

      <BulletsField control={control} index={index} />
    </div>
  )
}

function BulletsField({
  control,
  index
}: {
  control: Control<InsertExperienceSchema>
  index: number
}) {
  return (
    <FormField
      control={control}
      name={`experience.${index}.bullets`}
      render={({ field }) => (
        <FormItem className="w-full">
          <FormLabel>
            Write 3 to 5 accomplishments
            <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Textarea
              className="min-h-[100px]"
              placeholder={
                "Collaborated closely with cross-functional teams to ship new features\nCut page load time by 40% by splitting the bundle"
              }
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={fromBullets(field.value)}
              onChange={(e) => field.onChange(toBullets(e.target.value))}
            />
          </FormControl>
          <FormDescription>One accomplishment per line.</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}