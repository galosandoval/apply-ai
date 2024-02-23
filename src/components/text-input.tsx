import {
  type UseFormRegister,
  type FieldValues,
  type Path
} from "react-hook-form"
import { MyErrorMessage } from "./my-error-message"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

type NameInputProps<T extends FieldValues> = {
  label: string
  name: Path<T>
  register: UseFormRegister<T>
  errors: any
  required?: boolean
  placeholder?: string
}

export function TextInput<T extends FieldValues>({
  placeholder,
  label,
  name,
  register,
  errors,
  required
}: NameInputProps<T>) {
  return (
    <div className="w-full">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>

      <Input placeholder={placeholder} id={name} {...register(name)} />

      <MyErrorMessage errors={errors} name={name} />
    </div>
  )
}
