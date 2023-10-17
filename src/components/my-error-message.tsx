import { ErrorMessage } from "@hookform/error-message"
import { type FieldErrors, type Path } from "react-hook-form"

type Props<T extends Record<string, string>> = {
  errors: Partial<FieldErrors<T | T[]>>
  name: string
}

export function MyErrorMessage<T extends Record<Path<T>, string>>(
  props: Props<T>
) {
  return (
    <ErrorMessage
      errors={props.errors}
      name={props.name as any}
      render={({ message }) => <p className="text-sm text-error">{message}</p>}
    />
  )
}
