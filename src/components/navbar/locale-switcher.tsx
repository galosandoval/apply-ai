"use client"

import { useLocale, useTranslations } from "next-intl"
import { useTransition } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "~/components/ui/select"
import { usePathname, useRouter } from "~/i18n/navigation"
import { routing, type Locale } from "~/i18n/routing"
import { api } from "~/utils/api"

/**
 * Changes the language the interface is read in.
 *
 * Navigating is the whole visible effect. The locale lives in the URL, so
 * replacing the current path under the new one re-renders the page in it, and
 * `proxy.ts` hands the request to next-intl on the way through — which is what
 * writes the `NEXT_LOCALE` cookie. A signed-out reader gets that cookie and
 * nothing else, because there is no account to remember it on.
 *
 * `persist` adds the account write, and belongs to the signed-in navbar. It is
 * deliberately not awaited and its failure is not surfaced: the page has
 * already switched, and what a failed write costs is the preference on the
 * *next* device, not the language on this one.
 *
 * `replace` rather than `push` so switching twice doesn't bury the previous
 * page under two history entries of the same one.
 */
export function LocaleSwitcher({ persist = false }: { persist?: boolean }) {
  const t = useTranslations("localeSwitcher")
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const remember = api.profile.setLocale.useMutation()

  const handleChange = (next: Locale) => {
    if (next === locale) return

    startTransition(() => router.replace(pathname, { locale: next }))

    if (persist) remember.mutate({ locale: next })
  }

  return (
    <Select
      disabled={isPending}
      onValueChange={(next) => handleChange(next as Locale)}
      value={locale}
    >
      <SelectTrigger aria-label={t("label")} className="h-11 w-auto gap-2">
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {routing.locales.map((option) => (
          <SelectItem key={option} value={option}>
            {t(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
