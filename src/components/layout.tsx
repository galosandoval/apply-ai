import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle
} from "./ui/navigation-menu"
import { appPath } from "~/lib/path"

let showOnboarding = false
if (process.env.NODE_ENV === "development") {
  showOnboarding = true
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data } = useSession()

  let navbar: React.ReactNode = null

  if (data) {
    navbar = <ProtectedNavbar />
  }

  return (
    <>
      {navbar}

      {children}
    </>
  )
}

function ProtectedNavbar() {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut({ redirect: false })

    await router.push("/")
  }

  return (
    <div className="flex w-full items-center justify-between">
      <h1 className="text-2xl font-bold">
        Apply
        <span className="inline-block bg-gradient-to-r from-blue-600 via-green-500 to-indigo-400 bg-clip-text text-transparent">
          AI
        </span>
      </h1>

      <NavigationMenu className="w-full justify-between">
        <NavigationMenuList>
          <MyLink href={appPath.dashboard}>Dashboard</MyLink>
          {showOnboarding && <MyLink href={appPath.contact}>Onboarding</MyLink>}
          <MyLink href={appPath.resume}>Resumes</MyLink>
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

function MyLink({
  href,
  children
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <NavigationMenuItem>
      <Link href={href} legacyBehavior passHref>
        <NavigationMenuLink
          className={navigationMenuTriggerStyle({ className: "" })}
        >
          {children}
        </NavigationMenuLink>
      </Link>
    </NavigationMenuItem>
  )
}
