import {
  type UseFormRegister,
  type FieldValues,
  type Path
} from "react-hook-form"
import { MyErrorMessage } from "./my-error-message"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"

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
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>

      <Textarea
        placeholder={placeholder}
        id={name}
        className="min-h-[100px] resize-none"
        {...register(name)}
      />

      <MyErrorMessage errors={errors} name={name} />
    </div>
  )
}
