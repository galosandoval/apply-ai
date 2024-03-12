import { FieldValues, UseFormReturn } from "react-hook-form"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "~/components/ui/breadcrumb"
import { Form } from "~/components/ui/form"

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
  return (
    <div className="">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Contact</BreadcrumbPage>
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem>
            <BreadcrumbLink>Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <main className="h-full overflow-y-auto pb-16 pt-4 md:grid md:place-items-center">
        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <h1 className="mx-auto text-3xl">{title}</h1>

            {children}
          </form>
        </Form>
      </main>
    </div>
  )
}
