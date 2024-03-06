import { useSession } from "next-auth/react"

export function useUser() {
  const { data: session } = useSession()

  if (!session) {
    return { id: "" }
  }

  return session.user
}
