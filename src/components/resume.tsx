import { type RouterOutputs } from "~/utils/api"

export const Resume = ({
  data
}: {
  data: RouterOutputs["resume"]["readById"]
}) => {
  const resume = data[0]
  return (
    <main className="flex h-[29.7cm] w-[21cm] justify-center bg-white text-black">
      <div>
        <h1 className="text-3xl uppercase">{resume?.name}</h1>
        <h1 className="text-lg uppercase">{resume?.profession}</h1>Asdfasdf
      </div>
    </main>
  )
}
