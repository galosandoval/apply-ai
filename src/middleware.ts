export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    "/dashboard",
    "/resume",
    "/onboarding/experience",
    "/onboarding/education",
    "/onboarding/skills",
    "/onboarding/contact"
  ]
}
