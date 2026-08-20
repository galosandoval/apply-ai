"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink, loggerLink } from "@trpc/client"
import { useState } from "react"
import superjson from "superjson"
import { api } from "~/utils/api"

/**
 * The tRPC + React Query client, mounted once for the whole app.
 *
 * Both clients are created in state rather than at module scope: a module-level
 * client is shared across every request when this runs on the server, which
 * would leak one user's cache into another's response.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: process.env.NODE_ENV === "production",
            staleTime: 30 * 60
          }
        }
      })
  )

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error)
        }),
        httpBatchLink({
          // Relative: the API is always served from the same origin as the page.
          url: "/api/trpc",
          transformer: superjson
        })
      ]
    })
  )

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  )
}
