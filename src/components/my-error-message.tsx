"use client"

import { ErrorMessage } from "@hookform/error-message"
import { type FieldErrors, type Path } from "react-hook-form"
import { useValidationText } from "~/components/use-validation-text"

type Props<T extends Record<string, string>> = {
  errors: Partial<FieldErrors<T | T[]>>
  name: string
}

export function MyErrorMessage<T extends Record<Path<T>, string>>(
  props: Props<T>
) {
  const text = useValidationText()

  return (
    <ErrorMessage
      errors={props.errors}
      name={props.name as any}
      render={({ message }) => (
        <p className="text-[0.8rem] text-destructive">{text(message)}</p>
      )}
    />
  )
}
