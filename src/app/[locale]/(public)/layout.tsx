import { PublicNavbar } from "~/components/navbar/public-navbar"

/** The landing and legal pages: signed out, or signed in and still welcome. */
export default function PublicLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <PublicNavbar />
      {children}
    </>
  )
}
