import { ErrorMessage } from "@hookform/error-message"
import { type FieldErrorsImpl } from "react-hook-form"

type Props = {
  errors: FieldErrorsImpl<{
    email: string
    password: string
    passwordConfirmation: string
  }>
  name: string
}

export const MyErrorMessages = (props: Props) => {
  return (
    <ErrorMessage
      errors={props.errors}
      name={props.name}
      render={({ message }) => <p className="text-error">{message}</p>}
    />
  )
}
