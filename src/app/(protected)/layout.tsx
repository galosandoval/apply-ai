import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getServerAuthSession } from "~/server/auth"

/**
 * The auth boundary is the route group, not a string comparison on the path.
 * Nothing but the session check lives here — the navigation differs between
 * onboarding and the rest of the app, so each of those brings its own.
 *
 * `middleware.ts` redirects on a missing cookie for the same routes, but that
 * check is deliberately shallow — this one validates the session, so a stale or
 * forged cookie can't render a protected page shell.
 */
export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode
}) {
  const session = await getServerAuthSession(await headers())

  if (!session) redirect("/")

  return <>{children}</>
}
