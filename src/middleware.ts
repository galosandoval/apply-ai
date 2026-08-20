import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Routing and UX, not authorization.
 *
 * This only checks that a session cookie is present — it does not validate it,
 * because that would mean a database round trip on every navigation. Every
 * procedure behind these routes is a `protectedProcedure`, which is where the
 * actual check lives.
 */
export function middleware(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()

  return NextResponse.redirect(new URL("/", request.url))
}

export const config = {
  matcher: ["/dashboard", "/resume/:path*", "/onboarding/:path*"]
}
