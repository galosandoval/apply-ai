import {
  type FieldValues,
  type FieldPath,
  type ControllerRenderProps
} from "react-hook-form"
import { Textarea, type TextareaProps } from "./ui/textarea"
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage
} from "./ui/form"

interface TextareaInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> extends TextareaProps {
  label: string
  description?: string
  required?: boolean
  field: ControllerRenderProps<TFieldValues, TName>
}

export function MyTextarea<
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
        <Textarea className="min-h-[100px]" {...field} {...props} />
      </FormControl>
      <FormDescription>{description}</FormDescription>
      <FormMessage />
    </FormItem>
  )
}
