import {
  type UseFormRegister,
  type FieldValues,
  type Path,
  FieldPath,
  ControllerRenderProps
} from "react-hook-form"
import { MyErrorMessage } from "./my-error-message"
import { Label } from "./ui/label"
import { Textarea, TextareaProps } from "./ui/textarea"
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage
} from "./ui/form"

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

interface TextareaInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> extends TextareaProps {
  label: string
  description?: string
  required?: boolean
  field: ControllerRenderProps<TFieldValues, TName>
}

export function NewTextareaInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  description,
  label,
  required,
  field,
  ...props
}: TextareaInputProps<TFieldValues, TName>) {
  return (
    <FormItem className="w-full">
      <FormLabel>
        {label}
        {required && <span className="text-destructive">*</span>}
      </FormLabel>
      <FormControl>
        <Textarea {...field} {...props} />
      </FormControl>
      <FormDescription>{description}</FormDescription>
      <FormMessage />
    </FormItem>
  )
}
