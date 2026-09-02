export const appPath = {
  onboarding: "/onboarding",
  newResume: "/resumes/new",
  resumes: "/resumes",
  resumeById: (resumeId: string) => `/resumes/${resumeId}`
} as const
