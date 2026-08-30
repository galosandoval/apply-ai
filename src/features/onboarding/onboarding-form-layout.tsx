"use client"

import { type FieldValues, type UseFormReturn } from "react-hook-form"
import { Form } from "~/components/ui/form"

/**
 * The form shell shared by every onboarding step.
 *
 * Not a route layout: it needs the step's own `form` and submit handler, which
 * a Next layout can't be given. The page wrapper that *is* shared lives in
 * `src/app/(protected)/onboarding/layout.tsx`.
 */
export default function OnboardingFormLayout<T extends FieldValues>({
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
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <h1 className="text-3xl">{title}</h1>

        {children}
      </form>
    </Form>
  )
}
