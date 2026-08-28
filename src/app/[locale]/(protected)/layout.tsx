import { headers } from "next/headers"
import { redirect } from "~/i18n/navigation"
import { getServerAuthSession } from "~/server/auth"

/**
 * The auth boundary is the route group, not a string comparison on the path.
 * Nothing but the session check lives here — the navigation differs between
 * onboarding and the rest of the app, so each of those brings its own.
 *
 * `src/proxy.ts` redirects on a missing cookie for the same routes, but that
 * check is deliberately shallow — this one validates the session, so a stale or
 * forged cookie can't render a protected page shell.
 */
export default async function ProtectedLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const session = await getServerAuthSession(await headers())

  if (!session) {
    const { locale } = await params

    redirect({ href: "/", locale })
  }

  return <>{children}</>
}
