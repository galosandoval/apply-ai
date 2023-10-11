import {
  ErrorMessage,
  type FieldValuesFromFieldErrors
} from "@hookform/error-message"
import { type FieldName, type FieldErrors } from "react-hook-form"

type Props<T extends Record<string, string>> = {
  errors: Partial<FieldErrors<T | T[]>>
  name: FieldName<FieldValuesFromFieldErrors<FieldErrors<T>>>
}

export function MyErrorMessage<T extends Record<string, string>>(
  props: Props<T>
) {
  return (
    <ErrorMessage
      errors={props.errors}
      name={props.name}
      render={({ message }) => <p className="text-error text-sm">{message}</p>}
    />
  )
}
