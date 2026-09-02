import { getSessionCookie } from "better-auth/cookies"
import createIntlMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { routing } from "~/i18n/routing"
import { appPath } from "~/lib/path"

const handleLocale = createIntlMiddleware(routing)

/** Routes that require a session, written without a locale prefix. */
const protectedPaths = [
  pathMatcher(appPath.resumes, "subtree"),
  pathMatcher(appPath.onboarding, "exact")
]

/**
 * A matcher for one `appPath` entry. Segment comparison rather than a pattern:
 * the values in `appPath` exist to be concatenated into hrefs, and reading them
 * as regex source would make a future route carrying a `.` or a `+` match more
 * than it named, silently.
 *
 * `"subtree"` also matches everything below the route; `"exact"` matches only
 * the route itself.
 */
function pathMatcher(route: string, match: "exact" | "subtree") {
  return (path: string) =>
    path === route || (match === "subtree" && path.startsWith(`${route}/`))
}

/**
 * Locale resolution and the signed-out bounce, in that order.
 *
 * Locale runs first for two reasons. It rewrites unprefixed paths onto the
 * `[locale]` segment — with `localePrefix: "as-needed"` nothing under
 * `src/app` resolves without it, which is why the matcher below has to cover
 * every page and not just the protected ones. And it means the bounce has
 * somewhere honest to send people: a Spanish reader whose session expired
 * lands on `/es`, not on an English landing page.
 *
 * This also owns the signed-in `/` → `/resumes/new` redirect, which used to
 * be a static rule in `next.config.ts`. A config rule can't know that `/es` is
 * the same route as `/`.
 *
 * The session check here is routing and UX, not authorization. It only checks
 * that a cookie is present — validating it would mean a database round trip on
 * every navigation. Every procedure behind these routes is a
 * `protectedProcedure`, and `(protected)/layout.tsx` validates the session
 * before rendering, which is where the real check lives.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const locale = localeOf(pathname)
  const path = stripLocale(pathname, locale)
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`
  const hasSession = Boolean(getSessionCookie(request))

  if (path === "/" && hasSession) {
    return NextResponse.redirect(
      new URL(`${prefix}${appPath.newResume}`, request.url)
    )
  }

  if (!hasSession && protectedPaths.some((isProtected) => isProtected(path))) {
    return NextResponse.redirect(new URL(prefix || "/", request.url))
  }

  return handleLocale(request)
}

/**
 * The locale the URL is asking for. Only the prefix is consulted: an unprefixed
 * path is English by definition under `as-needed`, and letting a stale cookie
 * override that would make the same URL mean different things to different
 * people.
 */
function localeOf(pathname: string) {
  const locale = routing.locales.find(
    (candidate) =>
      pathname === `/${candidate}` || pathname.startsWith(`/${candidate}/`)
  )

  return locale ?? routing.defaultLocale
}

/** `/es/resumes` and `/resumes` are the same route — compare without the tag. */
function stripLocale(pathname: string, locale: string) {
  if (!pathname.startsWith(`/${locale}`)) return pathname

  return pathname.slice(locale.length + 1) || "/"
}

/** Every page, but no route handlers, static assets, or files with extensions. */
export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)"
}
