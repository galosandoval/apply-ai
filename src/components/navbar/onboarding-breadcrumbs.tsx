"use client"

import { Fragment } from "react"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "~/components/ui/breadcrumb"
import { appPath } from "~/lib/path"

/** In step order. The current step is the one the URL points at. */
const steps = [
  { href: appPath.import, label: "Import" },
  { href: appPath.contact, label: "Contact" },
  { href: appPath.education, label: "Education" },
  { href: appPath.experience, label: "Work Experience" },
  { href: appPath.skills, label: "Skills" }
]

export function OnboardingBreadcrumbs() {
  const pathname = usePathname()

  return (
    <Breadcrumb>
      <BreadcrumbList className="justify-center">
        {steps.map((step, index) => (
          <Fragment key={step.href}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {pathname === step.href ? (
                <BreadcrumbPage>{step.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={step.href}>{step.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
