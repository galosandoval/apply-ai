import dynamic from "next/dynamic"
import { Fragment } from "react"

const NoSsr = (props: { children: React.ReactNode }) => (
  <Fragment>{props.children}</Fragment>
)

export default dynamic(() => Promise.resolve(NoSsr), {
  ssr: false
})
