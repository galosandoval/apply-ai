"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type UseFormProps } from "react-hook-form"
import type { z, ZodTypeAny } from "zod"

export function useAppForm<TSchema extends ZodTypeAny>(
  schema: TSchema,
  options?: Partial<Omit<UseFormProps<z.infer<TSchema>>, "resolver">>
) {
  const form = useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema),
    ...options
  })

  return { ...form }
}
