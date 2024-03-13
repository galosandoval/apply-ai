import { useRouter } from "next/router"
import { type FieldValues, type UseFormReturn } from "react-hook-form"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "~/components/ui/breadcrumb"
import { Form } from "~/components/ui/form"
import { appPath } from "~/lib/path"

export default function OnboardingLayout<T extends FieldValues>({
  handleSubmit,
  title,
  children,
  form
}: {
  handleSubmit: () => void
  form: UseFormReturn<T>
  title: string
  children: React.ReactNode
}) {
  const router = useRouter()

  const isContactStep = router.pathname === appPath.contact
  const isEducationStep = router.pathname === appPath.education
  const isExperienceStep = router.pathname === appPath.experience
  const isSkillsStep = router.pathname === appPath.skills

  return (
    <div className="">
      <Breadcrumb>
        <BreadcrumbList className="justify-center">
          <BreadcrumbItem>
            {isContactStep ? (
              <BreadcrumbPage>Contact</BreadcrumbPage>
            ) : (
              <BreadcrumbLink href={appPath.contact}>Contact</BreadcrumbLink>
            )}
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem>
            {isEducationStep ? (
              <BreadcrumbPage>Education</BreadcrumbPage>
            ) : (
              <BreadcrumbLink href={appPath.education}>
                Education
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem>
            {isExperienceStep ? (
              <BreadcrumbPage>Work Experience</BreadcrumbPage>
            ) : (
              <BreadcrumbLink href={appPath.experience}>
                Work Experience
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem>
            {isSkillsStep ? (
              <BreadcrumbPage>Skills</BreadcrumbPage>
            ) : (
              <BreadcrumbLink href={appPath.skills}>Skills</BreadcrumbLink>
            )}
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <main className="h-full overflow-y-auto pb-16 pt-4 md:grid md:place-items-center">
        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <h1 className="text-3xl">{title}</h1>

            {children}
          </form>
        </Form>
      </main>
    </div>
  )
}
