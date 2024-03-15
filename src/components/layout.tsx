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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "~/components/ui/breadcrumb"

let showOnboarding = false
if (process.env.NODE_ENV === "development") {
  showOnboarding = true
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data } = useSession()

  let navbar: React.ReactNode = <PublicNavbar />

  if (data) {
    navbar = <ProtectedNavbar />
  }

  return (
    <div className="flex h-full flex-col">
      {navbar}

      {children}
    </div>
  )
}

function PublicNavbar() {
  return (
    <div className="fixed flex w-full items-center justify-between bg-background px-4 py-2 shadow-md">
      <h1 className="text-2xl font-bold">
        Apply
        <span className="inline-block bg-gradient-to-r from-blue-600 via-green-500 to-indigo-400 bg-clip-text text-transparent">
          AI
        </span>
      </h1>
    </div>
  )
}

function ProtectedNavbar() {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut({ redirect: false })

    await router.push("/")
  }

  const isOnboarding = router.pathname.includes("onboarding")

  return (
    <div className="fixed flex w-full items-center justify-between bg-background px-4 py-2 shadow-md">
      <h1 className="text-2xl font-bold">
        Apply
        <span className="inline-block bg-gradient-to-r from-blue-600 via-green-500 to-indigo-400 bg-clip-text text-transparent">
          AI
        </span>
      </h1>
      {isOnboarding ? (
        <Breadcrumbs />
      ) : (
        <>
          <div></div>
          <NavigationMenu className="w-full justify-between">
            <NavigationMenuList>
              <MyLink href={appPath.dashboard}>Dashboard</MyLink>
              {showOnboarding && (
                <MyLink href={appPath.contact}>Onboarding</MyLink>
              )}
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
        </>
      )}
    </div>
  )
}

function Breadcrumbs() {
  const router = useRouter()

  const isContactStep = router.pathname === appPath.contact
  const isEducationStep = router.pathname === appPath.education
  const isExperienceStep = router.pathname === appPath.experience
  const isSkillsStep = router.pathname === appPath.skills

  return (
    <Breadcrumb className="">
      <BreadcrumbList className="justify-center">
        <BreadcrumbItem>
          {isContactStep ? (
            <BreadcrumbPage>Contact</BreadcrumbPage>
          ) : (
            <BreadcrumbLink href={appPath.contact}>Contact</BreadcrumbLink>
          )}
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          {isEducationStep ? (
            <BreadcrumbPage>Education</BreadcrumbPage>
          ) : (
            <BreadcrumbLink href={appPath.education}>Education</BreadcrumbLink>
          )}
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          {isExperienceStep ? (
            <BreadcrumbPage>Work Experience</BreadcrumbPage>
          ) : (
            <BreadcrumbLink href={appPath.experience}>
              Work Experience
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          {isSkillsStep ? (
            <BreadcrumbPage>Skills</BreadcrumbPage>
          ) : (
            <BreadcrumbLink href={appPath.skills}>Skills</BreadcrumbLink>
          )}
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
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
