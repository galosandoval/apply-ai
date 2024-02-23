import { zodResolver } from "@hookform/resolvers/zod"
import { Cross1Icon } from "@radix-ui/react-icons"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { MyErrorMessage } from "~/components/my-error-message"
import { TextAreaInput } from "~/components/text-area"
import { TextInput } from "~/components/text-input"
import { Button } from "~/components/ui/button"
import {
  insertEducationSchema,
  type InsertEducationSchema
} from "~/server/db/crud-schema"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"
import { OnboardingLayout } from "../_layout"
import { MyAlert } from "~/components/alert"

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

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setFocus
  } = useForm<InsertEducationSchema>({
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

  const { fields, append, remove } = useFieldArray({
    name: "education",
    control
  })

  const onSubmit = async (data: InsertEducationSchema) => {
    const educationToSubmit = data.education.map((s) => ({
      ...s,
      profileId: profile?.id
    }))
    mutate({ education: educationToSubmit })
  }

  useEffect(() => {
    setFocus("education.0.name")

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <OnboardingLayout handleSubmit={handleSubmit(onSubmit)} title="Education">
      <MyAlert
        title="Note"
        description="Fill in your education in reverse chronilogical order"
      />

      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-col gap-2">
          <div>
            <div className="grid grid-cols-3 place-items-center">
              <div></div>
              <h2>School {index + 1}</h2>
              {fields.length > 1 ? (
                <Button
                  variant="outline"
                  type="button"
                  className="text-destructive justify-self-end"
                  size="icon"
                  onClick={() => remove(index)}
                >
                  <Cross1Icon />
                </Button>
              ) : null}
            </div>

            <TextInput
              name={`education.${index}.name`}
              errors={errors}
              label="Institution Name"
              placeholder="Ex: University of California, Berkeley"
              register={register}
              required
            />
          </div>

          <div className="flex justify-around gap-2">
            <TextInput
              name={`education.${index}.startDate`}
              errors={errors}
              label="Start"
              placeholder="Ex: Sept 2017"
              register={register}
              required
            />
            <TextInput
              name={`education.${index}.endDate`}
              errors={errors}
              label="End"
              placeholder="Ex: May 2021"
              register={register}
              required
            />
          </div>

          <TextInput
            name={`education.${index}.degree`}
            errors={errors}
            label="Degree/Certificate"
            placeholder="Ex: Computer Science"
            register={register}
            required
          />

          <TextInput
            name={`education.${index}.location`}
            errors={errors}
            label="Location"
            placeholder="Ex: Berkely, CA"
            register={register}
          />

          <TextInput
            name={`education.${index}.gpa`}
            errors={errors}
            label="GPA"
            placeholder="Only if your GPA was 3.5+"
            register={register}
          />

          <TextAreaInput
            name={`education.${index}.description`}
            errors={errors}
            label="Anything extra you want a hiring manager to know"
            placeholder="Ex: I was the president of the computer science club."
            register={register}
          />
        </div>
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
