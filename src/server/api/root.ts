import { createTRPCRouter } from "~/server/api/trpc"
import { profileRouter } from "./routers/profile"
import { resumeRouter } from "./routers/resume"
import { sectionRouter } from "./routers/section"

export const appRouter = createTRPCRouter({
  profile: profileRouter,
  resume: resumeRouter,
  section: sectionRouter
})

export type AppRouter = typeof appRouter
