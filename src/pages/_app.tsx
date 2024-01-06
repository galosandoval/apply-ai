import { type Session } from "next-auth"
import { SessionProvider } from "next-auth/react"
import { type AppType } from "next/app"
import { api } from "~/utils/api"
import { Roboto } from "next/font/google"
import Layout from "~/components/layout"
import "~/styles/global.css"
import { Toaster } from "react-hot-toast"

const roboto = Roboto({
  weight: ["100", "300", "400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-roboto"
})

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps }
}) => {
  const font = `${roboto.variable}`

  return (
    <SessionProvider session={session}>
      <Toaster />

      <Layout font={font}>
        <Component {...pageProps} />
      </Layout>
    </SessionProvider>
  )
}

export default api.withTRPC(MyApp)
