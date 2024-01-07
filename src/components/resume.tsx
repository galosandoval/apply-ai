import { type RouterOutputs } from "~/utils/api"

export const Resume = ({
  data
}: {
  data: RouterOutputs["resume"]["readById"] & { firstAndLastName: string }
}) => {
  return (
    <div className="h-[29.7cm] w-[21cm] bg-white px-20 py-16 text-[#727272]">
      <div className="flex h-full overflow-hidden">
        <div className="my-auto border-b border-[#737373]">
          <div className="flex max-h-[100px] flex-col items-center gap-4 pb-2">
            <h1 className="text-4xl font-semibold uppercase tracking-[.75rem]">
              {data.firstAndLastName}
            </h1>
            <h1 className="text-md mb-4 font-semibold uppercase tracking-[.25rem]">
              {data.profession}
            </h1>
          </div>
          <div className="w-full border-b border-[#737373]" />
          <section className="flex h-full">
            <div
              id="resume__left"
              className="h-full w-[38.2%] bg-[#f8f8f8] pb-10 text-[.65rem]"
            >
              <div
                id="contact"
                className="w-min border-b border-dotted border-[#737373] px-3"
              >
                <h2 className="text-[1rem] font-semibold uppercase tracking-[.15em]">
                  Contact
                </h2>
                <p className="pb-3">714-420-6969</p>
                <p className="pb-3">user.placeholder@email.com</p>
                <p className="pb-3">portfolio.sigma-mindset.com</p>
                <address className="pb-4">California, USA</address>
              </div>

              <div
                id="skills"
                className="w-[80%] border-b border-dotted border-[#737373] px-2 leading-tight"
              >
                <h2 className="text-[1rem] font-semibold uppercase tracking-[.15em]">
                  skills
                </h2>
                <ul className="ml-2 list-disc">
                  {data.skills
                    ?.split(",")
                    .map((skill) => <li key={skill}>{skill}</li>)}
                  <li>Programming Languages: TypeScript, JavaScript</li>
                  {/* <li>
                    Frontend Development: React.js, HTML, CSS, TailwindCSS
                  </li>
                  <li>
                    Agile Methodologies: Scrum, Stand-up Meetings, Continuous
                    Integration
                  </li>
                  <li>
                    Problem-Solving: Analytical thinking, creative approach to
                    challenges
                  </li>
                  <li className="pb-6">
                    Communication: Effective written and verbal communication
                    skills
                  </li> */}
                </ul>
              </div>

              <div
                id="skills"
                className="w-full border-b border-dotted border-[#737373] px-3 leading-tight"
              >
                <h2 className="pb-2 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  Education
                </h2>
                <h4 className="pb-2 font-bold">Certificate of Endorsement</h4>
                <h3 className="pb-2 text-[1rem] font-semibold">
                  Cal State Fullerton
                </h3>
                <p className="pb-2">2020-2021</p>
                <p className="pb-2">
                  Cal State Fullerton is also famously known for being called
                  Cal State Orange County because it has an incredibly high
                  acceptance rate. The majority of the student population are
                  local commuters.
                </p>

                <ul className="mx-auto w-[90%] list-disc pb-4">
                  <li>
                    Completed an intensive full stack web development and
                    computer science program.
                  </li>
                  <li>
                    Approached all coding challenges using pair programming,
                    fostering collaboration and skill development.
                  </li>
                  <li>
                    Utilized Git workflow on all projects, ensuring version
                    control and efficient team collaboration.
                  </li>
                  <li>
                    Gained hands-on experience with client and server testing,
                    ensuring robust and reliable applications.
                  </li>
                  <li>
                    Successfully completed all curriculum coursework, which
                    included in-depth training in React, Redux, Node, Express,
                    Jest, and Python.
                  </li>
                </ul>
              </div>

              <div id="contact" className="w-full px-3">
                <h2 className="pb-4 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  Interests
                </h2>
                <p className="">{data.interests}</p>
              </div>
            </div>
            <div
              id="resume__right"
              className="w-[61.8%] pl-4 text-[.65rem] leading-tight"
            >
              <div
                id="profile"
                className="border-b border-dotted border-[#737373] pr-2"
              >
                <h2 className="my-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  Profile
                </h2>
                <p className="pb-4">{data.introduction}</p>
              </div>

              <div id="work" className="">
                <h2 className="my-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  Work Experience
                </h2>

                <div className="flex flex-col justify-between">
                  {data.experience.map((job) => (
                    <div className="pb-3" key={job.id}>
                      <h3 className="pb-2 text-[1rem] font-semibold">
                        {job.title}
                      </h3>
                      <div className="flex justify-between pb-2">
                        <p>{job.companyName}</p>
                        <p className="capitalize">
                          {job.startDate} - {job.endDate}
                        </p>
                      </div>

                      {/* <p>{job.description}</p> */}
                      <ul className="ml-2 list-disc">
                        {job.description.split(". ").map((ka) => (
                          <li key={ka}>{ka}</li>
                        ))}

                        {/* <li>
                      Played a key role in enhancing app performance, reducing
                      loading times by up to 100% on critical views.
                    </li>
                    <li>
                      Implemented optimizations that significantly improved
                      developer workflows, contributing to streamlined
                      processes.
                    </li>
                    <li>
                      Developed widely-used functions, components, and classes
                      that contributed to the robustness of the codebase.
                    </li> */}
                      </ul>
                    </div>
                  ))}
                </div>
                {/* 
            <div id="job-card1" className="pb-3">
              <h3 className="pb-2 text-[1rem] font-semibold">
                jobTitle.placeholder
              </h3>
              <div className="pb-2 flex justify-between">
                <p>company.placeholder</p>
                <p>Oct 2022 - Present</p>
              </div>
              <ul className="ml-2 list-disc">
                <li>
                  Played a key role in enhancing app performance, reducing
                  loading times by up to 100% on critical views.
                </li>
                <li>
                  Implemented optimizations that significantly improved
                  developer workflows, contributing to streamlined processes.
                </li>
                <li>
                  Developed widely-used functions, components, and classes that
                  contributed to the robustness of the codebase.
                </li>
                <li>
                  Collaborated closely with cross-functional teams to ensure
                  seamless integration of new features and improvements.
                </li>
              </ul>
            </div>

            <div id="job-card2" className="pb-3">
              <h3 className="pb-2 text-[1rem] font-semibold">
                jobTitle.placeholder2
              </h3>
              <div className="pb-2 flex justify-between">
                <p>company.placeholder</p>
                <p>Jan 2022 - Oct 2022</p>
              </div>
              <ul className="ml-2 list-disc">
                <li>
                  Contributed to the development of the Disease Management
                  Platform (DMP), a large-scale enterprise platform.
                </li>
                <li>
                  large-scale enterprise platform. Documented processes and
                  actively participated in constructing the app from scratch.
                </li>
                <li>
                  Utilized React, TypeScript, Vite, Vitest, and TailwindCSS to
                  create intuitive and efficient user interfaces.
                </li>
                <li>
                  Employed Agile practices to compose views, components, and
                  workflows, ensuring rapid and effective development.
                </li>
              </ul>
            </div>

            <div id="job-card3" className="pb-3">
              <h3 className="pb-2 text-[1rem] font-semibold">
                jobTitle.placeholder3
              </h3>
              <div className="pb-2 flex justify-between">
                <p>company.placeholder</p>
                <p>May 2022 - Feb 2022</p>
              </div>
              <ul className="ml-2 list-disc">
                <li>
                  Led daily stand-up meetings to collaboratively troubleshoot
                  technical issues and ensure project progress.
                </li>
                <li>
                  Studied and implemented enterprise-level project workflows,
                  incorporating Agile values and DevOps practices.
                </li>
                <li>
                  Gained a comprehensive understanding of IBMs Hybrid Cloud
                  Services and their implications.
                </li>
              </ul>
            </div>

            <div id="job-card4">
              <h3 className="pb-2 text-[1rem] font-semibold">
                jobTitle.placeholder4
              </h3>
              <div className="pb-2 flex justify-between">
                <p>company.placeholder</p>
                <p>Feb 2022 - Mar 2020</p>
              </div>
              <ul className="ml-2 list-disc">
                <li>
                  Optimized operational systems, enhancing administration and
                  service flow within a high-volume coffee bar.
                </li>
                <li>
                  Achieved two bonuses through expense reduction strategies that
                  minimized waste and optimized staffing.
                </li>
                <li>
                  Conducted interviews, made hiring decisions, and provided
                  training for new staff members.
                </li>
              </ul>
            </div> */}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
