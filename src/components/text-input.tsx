import {
  type UseFormRegister,
  type FieldValues,
  type Path
} from "react-hook-form"
import { MyErrorMessage } from "./my-error-message"

type NameInputProps<T extends FieldValues> = {
  label: string
  name: Path<T>
  register: UseFormRegister<T>
  errors: any
}

export function TextInput<T extends FieldValues>({
  label,
  name,
  register,
  errors
}: NameInputProps<T>) {
  return (
    <div>
      <label htmlFor={name} className="label">
        <span className="label-text">
          {label}
          <span className="text-error">*</span>
        </span>
      </label>

      <input
        id={name}
        type="text"
        className="input input-bordered"
        {...register(name)}
      />

      <MyErrorMessage errors={errors} name={name} />
    </div>
  )
}
