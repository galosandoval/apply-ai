import { Link } from "~/i18n/navigation"

export function Logo() {
  return (
    <Link href="/" className="text-2xl font-bold">
      Apply
      <span className="inline-block bg-gradient-to-r from-blue-600 via-green-500 to-indigo-400 bg-clip-text text-transparent">
        AI
      </span>
    </Link>
  )
}
