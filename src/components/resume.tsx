import { Fragment } from "react"
import { type RouterOutputs } from "~/utils/api"

export const Resume = ({
  data
}: {
  data: RouterOutputs["resume"]["readById"] & {
    firstAndLastName: string
    email: string
    phone: string
    linkedIn?: string
    portfolio?: string
    location: string
  }
}) => {
  return (
    <div className="h-[29.7cm] w-[21cm] bg-white px-20 py-16 text-[#727272]">
      <div className="flex h-full overflow-hidden">
        <div className="my-auto max-h-full border-b border-[#737373]">
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
              className="flex w-[38.2%] flex-col bg-[#f8f8f8] text-[.65rem]"
            >
              <div
                id="contact"
                className="w-full border-b border-dotted border-[#737373] px-3"
              >
                <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  Contact
                </h2>
                <p className="pb-3">{data.phone}</p>
                <p className="pb-3">{data.email}</p>
                <p className="pb-3">{data.linkedIn}</p>
                <p className="pb-3">{data.portfolio}</p>
                <address className="pb-4">{data.location}</address>
              </div>

              <div
                id="skills"
                className="w-full border-b border-dotted border-[#737373] px-2 leading-tight"
              >
                <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  skills
                </h2>
                <ul className="grid list-disc pb-2 pl-2">
                  {data.skills
                    ?.split(",")
                    .map((skill) => <li key={skill}>{skill}</li>)}
                </ul>
              </div>

              <div
                id="education"
                className="w-full border-b border-dotted border-[#737373] px-3 pb-3 leading-tight"
              >
                <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  Education
                </h2>
                {data.education.map((school) => (
                  <Fragment key={school.id}>
                    <h4 className="pb-1 font-bold">{school.degree}</h4>
                    <h3 className="pb-1 text-[1rem] font-semibold">
                      {school.name}
                    </h3>
                    <p className="pb-1">
                      {school.startDate} - {school.endDate}
                    </p>

                    <p>{school.description}</p>
                  </Fragment>
                ))}
              </div>

              <div id="interests" className="w-full px-3 pb-3">
                <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  Interests
                </h2>
                <p className="">{data.interests}</p>
              </div>
            </div>
            <div
              id="resume__right"
              className="flex w-[61.8%] flex-col overflow-hidden pl-4 text-[.65rem] leading-tight"
            >
              <div
                id="profile"
                className="border-b border-dotted border-[#737373] pr-2"
              >
                <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  Profile
                </h2>
                <p className="pb-4">{data.introduction}</p>
              </div>

              <div id="work">
                <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  Work Experience
                </h2>

                <div className="flex max-h-full flex-col justify-between">
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
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
