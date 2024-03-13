import {
  type FieldValues,
  type ControllerRenderProps,
  type FieldPath
} from "react-hook-form"
import { Input, type InputProps } from "./ui/input"
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage
} from "./ui/form"

interface TextInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> extends InputProps {
  label: string
  description?: string
  required?: boolean
  field: ControllerRenderProps<TFieldValues, TName>
}

export function MyInput<
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
