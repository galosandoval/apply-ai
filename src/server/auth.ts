import { compare } from "bcryptjs"
import { eq } from "drizzle-orm"
import { type GetServerSidePropsContext } from "next"
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions
} from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"

import { db } from "~/server/db"
import { user } from "~/server/db/schema"

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"]
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

export const authorizeParams = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(50)
})

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id
      }

      return token
    },
    session: ({ session, token }) => {
      if (token?.id) {
        session.user.id = token.id as string
      }

      return session
    }
  },

  session: {
    strategy: "jwt"
  },

  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Username", type: "text", placeholder: "jsmith" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (credentials) => {
        const input = authorizeParams.parse(credentials)

        const foundUser = await db
          .select()
          .from(user)
          .where(eq(user.email, input.email))

        if (!foundUser || foundUser.length === 0) {
          return null
        }
        const isValidPassword = await compare(
          input.password,
          foundUser[0]?.password ?? ""
        )

        if (!isValidPassword) {
          return null
        }

        return {
          id: foundUser[0]?.id ?? "",
          email: foundUser[0]?.email ?? "",
          profileId: ""
        }
      }
    })
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ]
}

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext["req"]
  res: GetServerSidePropsContext["res"]
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions)
}
