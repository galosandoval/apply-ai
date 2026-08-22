/**
 * The client-side entrypoint for the tRPC API: type-safe React Query hooks
 * plus inference helpers for input and output types.
 *
 * `@trpc/react-query` rather than `@trpc/next` — App Router has no
 * `_app.tsx` to wrap, so the provider is mounted explicitly in the root layout.
 */
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server"
import { createTRPCReact } from "@trpc/react-query"

import { type AppRouter } from "~/server/api/root"

/** A set of type-safe react-query hooks for your tRPC API. */
export const api = createTRPCReact<AppRouter>()

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>
