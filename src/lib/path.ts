export const appPath = {
  import: "/onboarding/import",
  contact: "/onboarding/contact",
  education: "/onboarding/education",
  experience: "/onboarding/experience",
  skills: "/onboarding/skills",
  dashboard: "/dashboard",
  resume: "/resume",
  resumeById: (resumeId: string) => `/resume/${resumeId}`
} as const
