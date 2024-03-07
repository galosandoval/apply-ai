export default function OnboardingLayout({
  handleSubmit,
  title,
  children
}: {
  handleSubmit: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <main className="h-full overflow-y-auto pb-16 pt-4 md:grid md:place-items-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <h1 className="mx-auto text-3xl">{title}</h1>

        {children}
      </form>
    </main>
  )
}
