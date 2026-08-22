import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { type NextRequest } from "next/server"
import { env } from "~/env"
import { appRouter } from "~/server/api/root"
import { createTRPCContext } from "~/server/api/trpc"

// Parsing a resume means a PDF read plus an OpenAI round trip, which runs past
// the default timeout on a long resume.
export const maxDuration = 60

/** `~/server/db` opens a pg pool and runs migrations — never the edge runtime. */
export const runtime = "nodejs"

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: ({ req: request, info, resHeaders }) =>
      createTRPCContext({ req: request, info, resHeaders }),
    onError:
      env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`
            )
          }
        : undefined
  })

export { handler as GET, handler as POST }
