/**
 * Validation messages a schema cannot translate for itself.
 *
 * The insert schemas are shared: the server validates every write against them,
 * and the onboarding forms validate keystrokes against the same rules so the
 * user is told about a 3-character name before they submit it. That leaves them
 * with no locale to write in — a module evaluated once at import time cannot
 * know which language the request that will use it arrives in.
 *
 * So the message a schema produces is a *key and its numbers*, and the language
 * is decided where the message is drawn: `MyErrorMessage` and `FormMessage`,
 * the two places a field error reaches the page. Anything that is already plain
 * text — a better-auth message, an error a library wrote — passes straight
 * through, so this is additive rather than a format everything must adopt.
 */

/** Marks a message as one of ours. Nothing else in a zod message starts with it. */
const marker = "i18n:"

export type MessageValues = Record<string, string | number>

/** A message the render point resolves against the `validation` namespace. */
export function invalid(key: string, values?: MessageValues) {
  return `${marker}${JSON.stringify(values ? { key, values } : { key })}`
}

type Translate = (key: string, values?: MessageValues) => string

/**
 * The message as the user should read it.
 *
 * A key the message files have never heard of resolves to itself rather than
 * throwing — a form that cannot render its own error is worse than one showing
 * a key nobody translated yet.
 */
export function translateValidation(message: string, t: Translate) {
  if (!message.startsWith(marker)) return message

  try {
    const { key, values } = JSON.parse(message.slice(marker.length)) as {
      key: string
      values?: MessageValues
    }

    return t(key, values)
  } catch {
    return message
  }
}
