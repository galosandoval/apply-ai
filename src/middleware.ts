export { default } from "next-auth/middleware"

export const config = {
  matcher: ["/dashboard", "/resume", "/onboarding/:path*"]
}
