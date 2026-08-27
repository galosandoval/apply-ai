"use client"

import { createAuthClient } from "better-auth/react"

/**
 * The browser half of better-auth. `signIn`, `signUp`, `signOut` and
 * `useSession` all speak to `/api/auth/*` on the same origin.
 */
export const authClient = createAuthClient()

export const { signIn, signUp, signOut, useSession } = authClient
