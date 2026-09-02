"use client"

import { useTranslations } from "next-intl"
import { translateValidation } from "~/lib/validation-message"

/**
 * Reads a field error in the interface's language.
 *
 * Shared by the two places a field error is drawn, so a message written by
 * `invalid` reads the same whichever form produced it. A key with no message
 * behind it falls back to the raw text rather than throwing: next-intl treats a
 * missing key as a development error, and a form that cannot render its own
 * validation is worse than one showing an untranslated string.
 */
export function useValidationText() {
  const t = useTranslations("validation")

  return (message: string) =>
    translateValidation(message, (key, values) =>
      t.has(key) ? t(key, values) : message
    )
}
