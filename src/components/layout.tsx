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
    <NavigationMenu>
      <NavigationMenuList>
        <MyLink href={appPath.dashboard}>dashboard</MyLink>
        <MyLink href={appPath.contact}>onboarding</MyLink>
        <MyLink href={appPath.resume}>resume</MyLink>
        <NavigationMenuItem asChild>
          <button
            className={navigationMenuTriggerStyle()}
            onClick={handleSignOut}
          >
            signOut
          </button>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
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
        <NavigationMenuLink className={navigationMenuTriggerStyle()}>
          {children}
        </NavigationMenuLink>
      </Link>
    </NavigationMenuItem>
  )
}
