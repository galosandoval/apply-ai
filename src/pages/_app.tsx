import { type Session } from "next-auth"
import { SessionProvider } from "next-auth/react"
import { type AppType } from "next/app"
import { api } from "~/utils/api"
import Layout from "~/components/layout"
import "~/styles/global.css"
import { Toaster } from "react-hot-toast"
import { GeistSans } from "geist/font/sans"
import { cn } from "~/lib/utils"

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps }
}) => {
  return (
    <SessionProvider session={session}>
      <div className={cn("h-full font-sans antialiased", GeistSans.variable)}>
        <Toaster />

        <Layout>
          <Component {...pageProps} />
        </Layout>
      </div>
    </SessionProvider>
  )
}

export default api.withTRPC(MyApp)
