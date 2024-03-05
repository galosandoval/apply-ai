import { useSession } from "next-auth/react"

export function useUser() {
  const { data: session } = useSession()

  console.log(session)

  if (!session) {
    return { id: "" }
  }

  return session.user
}
