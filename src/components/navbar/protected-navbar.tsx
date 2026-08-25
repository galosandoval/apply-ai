"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
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
 * `children` is the slot the onboarding layout fills with its step tabs, which
 * used to be a `pathname.includes("onboarding")` branch in here.
 */
export function ProtectedNavbar({ children }: { children?: React.ReactNode }) {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()

    router.push("/")
  }

  return (
    <div className="fixed flex w-full items-center justify-between bg-background px-4 py-2 shadow-md">
      <Logo />

      {children ?? (
        <>
          <div></div>
          <NavigationMenu className="w-full justify-between">
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
        </>
      )}
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
