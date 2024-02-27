import { InfoCircledIcon } from "@radix-ui/react-icons"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"

export function MyAlert({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <Alert variant="default" className="bg-sky-100">
      <InfoCircledIcon className="h-4 w-4" color="#00749E" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="whitespace-pre-line">
        {description}
      </AlertDescription>
    </Alert>
  )
}
