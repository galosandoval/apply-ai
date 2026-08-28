"use client"

import { Link } from "~/i18n/navigation"
import { useRouter } from "~/i18n/navigation"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle
} from "~/components/ui/navigation-menu"
import { signOut } from "~/lib/auth-client"
import { appPath } from "~/lib/path"
import { Logo } from "./logo"

/** A shortcut back into onboarding, for working on it without re-registering. */
const showOnboarding = process.env.NODE_ENV === "development"

/**
 * The signed-in navbar. Rendered by the `(protected)` layout, so it no longer
 * asks whether there is a session — being here means there is one.
 *
 * `children` is the slot the onboarding layout fills with its step breadcrumbs.
 * It sits beside the links rather than replacing them — a trail says where you
 * are, so the way out of onboarding has to stay on screen next to it.
 *
 * Sticky rather than fixed: it stays pinned either way, but sticky keeps the
 * bar in flow so it reserves its own height. Fixed took it out of flow and
 * every page under it had to know the bar's height to pad around it.
 */
export function ProtectedNavbar({ children }: { children?: React.ReactNode }) {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()

    router.push("/")
  }

  return (
    <div className="sticky top-0 z-50 flex w-full shrink-0 items-center justify-between gap-4 bg-background px-4 py-2 shadow-md">
      <Logo />

      {children}

      <NavigationMenu className="shrink-0">
        <NavigationMenuList>
          <NavLink href={appPath.dashboard}>Dashboard</NavLink>
          {showOnboarding && (
            <NavLink href={appPath.onboarding}>Onboarding</NavLink>
          )}
          <NavLink href={appPath.resume}>Resumes</NavLink>
          <NavigationMenuItem asChild>
            <button
              className={navigationMenuTriggerStyle()}
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  )
}

function NavLink({
  href,
  children
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <NavigationMenuItem>
      <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
        <Link href={href}>{children}</Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  )
}
