import { userRouter } from "~/server/api/routers/user"
import { createTRPCRouter } from "~/server/api/trpc"
import { profileRouter } from "./routers/profile"
import { resumeRouter } from "./routers/resume"

export const appRouter = createTRPCRouter({
  user: userRouter,
  profile: profileRouter,
  resume: resumeRouter
})

export type AppRouter = typeof appRouter
