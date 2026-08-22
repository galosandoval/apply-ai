import { GeistSans } from "geist/font/sans"
import { type Metadata } from "next"
import { Toaster } from "react-hot-toast"
import { cn } from "~/lib/utils"
import "~/styles/global.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: {
    default: "ApplyAI",
    template: "%s · ApplyAI"
  },
  description:
    "Created by Galo Sandoval to make the job application process easier.",
  icons: { icon: "/favicon.ico" }
}

/**
 * The shell every page shares. The navbar is not here: which one you get is
 * decided by the route group you are in, not by reading the session at render
 * time and branching.
 */
export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={cn("h-full font-sans antialiased", GeistSans.variable)}>
        <Providers>
          <Toaster />

          <div className="flex h-full flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  )
}
