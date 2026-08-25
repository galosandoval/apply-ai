export const appPath = {
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  resume: "/resume",
  resumeById: (resumeId: string) => `/resume/${resumeId}`
} as const
