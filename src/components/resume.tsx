import { type RouterOutputs } from "~/utils/api"

export const Resume = ({
  data
}: {
  data: RouterOutputs["resume"]["readById"]
}) => {
  const resume = data[0]
  return (
    <main className="m-12 h-[29.7cm] w-[21cm] bg-white px-20 py-16 text-[#727272] shadow-2xl">
      <div className="flex flex-col items-center justify-center">
        <h1 className="mb-4 text-4xl font-semibold uppercase tracking-[.75rem]">
          Galo Sandoval
        </h1>
        <h1 className="text-md mb-8 font-semibold uppercase tracking-[.25rem]">
          software engineer
        </h1>
      </div>
      <div className="w-full border-b border-[#737373]" />
      <section className="flex h-[23.5cm]">
        <div
          id="resume__left"
          className="h-full w-[38.2%] bg-[#f8f8f8] text-[.65rem]"
        >
          <div
            id="contact"
            className="w-min border-b border-dotted border-[#737373] px-3"
          >
            <h2 className="text-[1rem] font-semibold uppercase tracking-[.15em]">
              Contact
            </h2>
            <p className="mb-3">714-420-6969</p>
            <p className="mb-3">user.placeholder@email.com</p>
            <p className="mb-3">portfolio.sigma-mindset.com</p>
            <address className="mb-4">California, USA</address>
          </div>

          <div
            id="skills"
            className="w-[80%] border-b border-dotted border-[#737373] px-3 leading-tight"
          >
            <h2 className="text-[1rem] font-semibold uppercase tracking-[.15em]">
              skills
            </h2>
            <ul className="list-disc ml-2">
              <li>Programming Languages: TypeScript, JavaScript</li>
              <li>Frontend Development: React.js, HTML, CSS, TailwindCSS</li>
              <li>
                Agile Methodologies: Scrum, Stand-up Meetings, Continuous
                Integration
              </li>
              <li>
                Problem-Solving: Analytical thinking, creative approach to
                challenges
              </li>
              <li className="mb-6">
                Communication: Effective written and verbal communication skills
              </li>
            </ul>
          </div>

          <div
            id="skills"
            className="w-full border-b border-dotted border-[#737373] px-3 leading-tight"
          >
            <h2 className="mb-2 text-[1rem] font-semibold uppercase tracking-[.15em]">
              Education
            </h2>
            <h4 className="mb-2 font-bold">Certificate of Endorsement</h4>
            <h3 className="mb-2 text-[1rem] font-semibold">
              Cal State Fullerton
            </h3>
            <p className="mb-2">2020-2021</p>
            <p className="mb-2">
              Cal State Fullerton is also famously known for being called Cal
              State Orange County because it has an incredibly high acceptance
              rate. The majority of the student population are local commuters.
            </p>

            <ul className="mx-auto w-[90%] list-disc mb-4">
              <li>
                Completed an intensive full stack web development and computer
                science program.
              </li>
              <li>
                Approached all coding challenges using pair programming,
                fostering collaboration and skill development.
              </li>
              <li>
                Utilized Git workflow on all projects, ensuring version control
                and efficient team collaboration.
              </li>
              <li>
                Gained hands-on experience with client and server testing,
                ensuring robust and reliable applications.
              </li>
              <li>
                Successfully completed all curriculum coursework, which included
                in-depth training in React, Redux, Node, Express, Jest, and
                Python.
              </li>
            </ul>
          </div>

          <div id="contact" className="w-full px-3">
            <h2 className="text-[1rem] font-semibold uppercase tracking-[.15em] mb-4">
              Interests
            </h2>
            <p className="">
              All of my hobbies so happen to be the responsibilities of the job
              at hand.
            </p>
          </div>
        </div>
        <div id="resume__right" className=""></div>
      </section>
      <div className="mt w-full border-b border-[#737373]" />
    </main>
  )
}
