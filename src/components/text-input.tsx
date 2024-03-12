import {
  type UseFormRegister,
  type FieldValues,
  type Path,
  type ControllerRenderProps,
  type FieldPath
} from "react-hook-form"
import { MyErrorMessage } from "./my-error-message"
import { Input, InputProps } from "./ui/input"
import { Label } from "./ui/label"
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage
} from "./ui/form"

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

interface TextInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> extends InputProps {
  label: string
  description?: string
  required?: boolean
  field: ControllerRenderProps<TFieldValues, TName>
}

export function NewTextInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  description,
  label,
  required,
  field,
  ...props
}: TextInputProps<TFieldValues, TName>) {
  return (
    <FormItem className="w-full">
      <FormLabel>
        {label}
        {required && <span className="text-destructive">*</span>}
      </FormLabel>
      <FormControl>
        <Input {...field} {...props} />
      </FormControl>
      <FormDescription>{description}</FormDescription>
      <FormMessage />
    </FormItem>
  )
}
