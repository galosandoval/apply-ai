import { headers } from "next/headers"
import { OnboardingShell } from "~/features/onboarding/onboarding-shell"
import { redirect } from "~/i18n/navigation"
import { appPath } from "~/lib/path"
import { getServerAuthSession } from "~/server/auth"
import { db } from "~/server/db"
import { hasProfile } from "~/server/modules/profile/profile.service"

/**
 * Onboarding trades the app navigation for its step tabs. The shell is a client
 * component because the open step is state, and both the header tabs and the
 * page's panel read it.
 *
 * The gate sits here for the same reason the session check sits in
 * `(protected)/layout.tsx`: the boundary belongs to the route, not to the page
 * that happens to render behind it. `src/proxy.ts` can't ask this one — it
 * deliberately does no database work, and whether a profile exists is a read.
 *
 * Onboarding is for users who haven't got one yet. A returning user already
 * walked one of the two routes through the fork, so it has nothing left to ask
 * them, and they go where finishing onboarding would have sent them anyway.
 */
export default async function OnboardingLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  // The parent layout has already turned away whoever isn't signed in; this
  // reads the session for the id, not to decide whether there is one.
  const session = await getServerAuthSession(await headers())

  if (session && (await hasProfile(db, session.user.id))) {
    const { locale } = await params

    redirect({ href: appPath.newResume, locale })
  }

  return <OnboardingShell>{children}</OnboardingShell>
}
