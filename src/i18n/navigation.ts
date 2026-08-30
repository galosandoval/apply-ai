import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

/**
 * Locale-aware replacements for the `next/navigation` and `next/link` exports.
 *
 * Import these instead of the Next ones anywhere inside `src/app` — they carry
 * the active locale into the href, so a Spanish user stays on `/es/*` instead
 * of being dropped back into English on the first internal navigation.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
