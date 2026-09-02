import { ProtectedNavbar } from "~/components/navbar/protected-navbar"

/**
 * The signed-in app: creating a resume and the saved ones, under the app
 * navigation.
 *
 * Split from `(protected)` because onboarding is also signed-in but wears
 * breadcrumbs instead — and a nested layout adds to its parent rather than
 * replacing it, so the navbar has to live one level down.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ProtectedNavbar />
      {children}
    </>
  )
}
