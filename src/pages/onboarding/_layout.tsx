import { type FieldValues, type UseFormReturn } from "react-hook-form"
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
    <main className="h-full overflow-y-auto md:grid md:place-items-center">
      <Form {...form}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 py-16">
          <h1 className="text-3xl">{title}</h1>

          {children}
        </form>
      </Form>
    </main>
  )
}
