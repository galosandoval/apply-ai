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
import { MyErrorMessage } from "~/components/my-error-message"
import { NewTextareaInput } from "~/components/text-area"
import { NewTextInput } from "~/components/text-input"
import { Button } from "~/components/ui/button"
import {
  insertEducationSchema,
  type InsertEducationSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"
import { MyAlert } from "~/components/alert"
import OnboardingLayout from "../_layout"
import { FormField } from "~/components/ui/form"

const initialSchool: InsertEducationSchema["education"] = [
  {
    degree: "",
    description: "",
    name: "",
    endDate: "",
    gpa: "",
    location: "",
    startDate: ""
  }
]

const maxSchools = 4

export default function Step3() {
  const router = useRouter()
  const { id } = useUser()

  const { data: profile } = api.profile.read.useQuery(
    { userId: id },
    { enabled: !!id }
  )

  const { mutate } = api.profile.addEducation.useMutation({
    onError: (error) => {
      toast.error(error.message)
      router.push("/onboarding/step3")
    },

    onMutate: () => router.push("/onboarding/step4")
  })

  const form = useForm<InsertEducationSchema>({
    resolver: zodResolver(insertEducationSchema),

    defaultValues: {
      education: profile?.education.length
        ? profile.education.map((school) => ({
            degree: school.degree,
            endDate: school.endDate,
            name: school.name,
            startDate: school.startDate,
            description: school.description,
            gpa: school.gpa,
            location: school.location
          }))
        : initialSchool
    },

    values: {
      education: profile?.education.length
        ? profile.education.map((school) => ({
            degree: school.degree,
            endDate: school.endDate,
            name: school.name,
            startDate: school.startDate,
            description: school.description,
            gpa: school.gpa,
            location: school.location
          }))
        : initialSchool
    }
  })

  const {
    handleSubmit,
    formState: { errors },
    control,
    setFocus,
    watch
  } = form

  const { fields, append, remove } = useFieldArray({
    name: "education",
    control
  })

  const onSubmit = async (data: InsertEducationSchema) => {
    const educationToSubmit = data.education.map((s) => ({
      ...s,
      profileId: profile?.id
    }))
    mutate({ education: educationToSubmit, profileId: profile?.id })
  }

  const hasMoreThanOneSchool = fields.length > 1

  useEffect(() => {
    setFocus("education.0.name")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <OnboardingLayout
      form={form}
      handleSubmit={handleSubmit(onSubmit)}
      title="Education"
    >
      {hasMoreThanOneSchool && (
        <MyAlert
          title="Note"
          description="Fill in your education in reverse chronological order"
        />
      )}

      {fields.map((field, index) => (
        <EducationForm
          control={control}
          field={field}
          watch={watch}
          index={index}
          hasMoreThanOneSchool={hasMoreThanOneSchool}
          remove={remove}
          key={field.id}
        />
      ))}

      <MyErrorMessage errors={errors} name="education.root" />

      <div className="ml-auto space-x-2">
        {fields.length < maxSchools && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => append(initialSchool)}
          >
            Add another
          </Button>
        )}

        <Button type="submit">Next</Button>
      </div>
    </OnboardingLayout>
  )
}

function EducationForm({
  field,
  watch,
  index,
  hasMoreThanOneSchool,
  remove,
  control
}: {
  field: FieldArrayWithId<InsertEducationSchema>
  watch: UseFormWatch<InsertEducationSchema>
  index: number
  hasMoreThanOneSchool: boolean
  remove: UseFieldArrayRemove
  control: Control<InsertEducationSchema>
}) {
  const nameSub = watch(`education.${index}.name`)

  let fieldTitle = ""
  if (hasMoreThanOneSchool) {
    if (nameSub) {
      fieldTitle = nameSub
    } else {
      fieldTitle = `School ${index + 1}`
    }
  }

  return (
    <div key={field.id} className="flex flex-col gap-2">
      <div className="flex justify-between">
        <h2>{fieldTitle}</h2>

        {hasMoreThanOneSchool ? (
          <Button
            variant="outline"
            type="button"
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
        name={`education.${index}.name`}
        render={({ field }) => (
          <NewTextInput
            field={field}
            label="Institution Name"
            placeholder="Ex: University of California, Berkeley"
            required
          />
        )}
      />

      <div className="flex justify-around gap-2">
        <FormField
          control={control}
          name={`education.${index}.startDate`}
          render={({ field }) => (
            <NewTextInput
              field={field}
              label="Start"
              placeholder="Ex: Sept 2017"
              required
            />
          )}
        />
        <FormField
          control={control}
          name={`education.${index}.endDate`}
          render={({ field }) => (
            <NewTextInput
              field={field}
              label="End"
              placeholder="Ex: May 2021"
              required
            />
          )}
        />
      </div>

      <FormField
        control={control}
        name={`education.${index}.degree`}
        render={({ field }) => (
          <NewTextInput
            field={field}
            label="Degree/Certificate"
            placeholder="Ex: Computer Science"
            required
          />
        )}
      />

      <FormField
        control={control}
        name={`education.${index}.location`}
        render={({ field }) => (
          <NewTextInput
            field={field}
            label="Location"
            placeholder="Ex: Berkely, CA"
          />
        )}
      />

      <FormField
        control={control}
        name={`education.${index}.gpa`}
        render={({ field }) => (
          <NewTextInput
            field={field}
            label="GPA"
            placeholder="Only if your GPA was 3.5+"
          />
        )}
      />

      <FormField
        control={control}
        name={`education.${index}.description`}
        render={({ field }) => (
          <NewTextareaInput
            field={field}
            label="Anything extra you want a hiring manager to know"
            placeholder="Ex: I was the president of the computer science club."
          />
        )}
      />
    </div>
  )
}
