"use client"

import { useSession } from "~/lib/auth-client"

/** The signed-in user, or an empty id while the session is still loading. */
export function useUser() {
  const { data } = useSession()

  return data?.user ?? { id: "" }
}
