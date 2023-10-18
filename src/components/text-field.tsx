import {
  type UseFormRegister,
  type FieldValues,
  type Path
} from "react-hook-form"
import { MyErrorMessage } from "./my-error-message"

type TextAreaInputProps<T extends FieldValues> = {
  label: string
  name: Path<T>
  register: UseFormRegister<T>
  errors?: any
  required?: boolean
  placeholder?: string
}

export function TextAreaInput<T extends FieldValues>({
  placeholder,
  label,
  name,
  register,
  errors,
  required
}: TextAreaInputProps<T>) {
  return (
    <div>
      <label htmlFor={name} className="label">
        <span className="label-text">
          {label}

          {required && <span className="text-error">*</span>}
        </span>
      </label>

      <textarea
        placeholder={placeholder}
        id={name}
        className="textarea textarea-primary min-h-[180px] min-w-[400px]"
        {...register(name)}
      />

      <MyErrorMessage errors={errors} name={name} />
    </div>
  )
}
