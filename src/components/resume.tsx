import { Fragment } from "react"
import { type FinishedParsed } from "~/pages/dashboard"
import { type RouterOutputs } from "~/utils/api"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { cn } from "~/lib/utils"

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

export const ResumeInChat = ({
  firstName,
  lastName,
  email,
  phone,
  linkedIn,
  portfolio,
  location,
  parsed,
  isEditing
}: {
  firstName: string
  lastName: string
  email: string
  phone: string
  linkedIn?: string
  portfolio?: string
  location: string
  parsed: FinishedParsed
  isEditing: EditableFields
}) => {
  return (
    <div className="h-[29.7cm] w-[21cm] px-20 py-16">
      <div className="flex h-full overflow-hidden">
        <div className="my-auto max-h-full border-b border-[#737373]">
          <div className="flex max-h-[100px] flex-col items-center gap-4 pb-2">
            <div className="flex gap-5">
              {isEditing.firstName ? (
                <Input
                  className="w-fit text-4xl font-semibold uppercase tracking-[.75rem]"
                  value={firstName}
                />
              ) : (
                <h1
                  id="firstName"
                  className={cn(
                    "rounded border border-transparent text-4xl font-semibold uppercase tracking-[.75rem]",
                    {
                      "cursor-pointer hover:border hover:border-blue-800 hover:bg-sky-200":
                        !isEditing.firstName
                    }
                  )}
                >
                  {firstName}
                </h1>
              )}
              {isEditing.lastName ? (
                <Input
                  className="w-fit text-4xl font-semibold uppercase tracking-[.75rem]"
                  value={lastName}
                />
              ) : (
                <h1
                  id="lastName"
                  className="text-4xl font-semibold uppercase tracking-[.75rem]"
                >
                  {lastName}
                </h1>
              )}
            </div>

            {isEditing.profession ? (
              <Input
                className="text-md mb-4 w-fit font-semibold uppercase tracking-[.25rem]"
                value={parsed.profession}
              />
            ) : (
              <h1
                id="profession"
                className="text-md mb-4 font-semibold uppercase tracking-[.25rem]"
              >
                {parsed.profession}
              </h1>
            )}
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
                {isEditing.phone ? (
                  <Input className="text-xs" value={phone} id="phone" />
                ) : (
                  <p id="phone" className="pb-3">
                    {phone}
                  </p>
                )}

                {isEditing.email ? (
                  <Input className="text-xs" value={email} id="email" />
                ) : (
                  <p id="email" className="pb-3">
                    {email}
                  </p>
                )}

                {isEditing.linkedIn ? (
                  <Input className="text-xs" value={linkedIn} id="linkedIn" />
                ) : (
                  <p id="linkedIn" className="pb-3">
                    {linkedIn}
                  </p>
                )}

                {isEditing.portfolio ? (
                  <Input className="text-xs" value={portfolio} id="portfolio" />
                ) : (
                  <p id="portfolio" className="pb-3">
                    {portfolio}
                  </p>
                )}

                {isEditing.location ? (
                  <Input className="text-xs" value={location} id="location" />
                ) : (
                  <address id="location" className="pb-4">
                    {location}
                  </address>
                )}
              </div>

              <div
                id="skills"
                className="w-full border-b border-dotted border-[#737373] px-2 leading-tight"
              >
                <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  skills
                </h2>
                {isEditing.skills ? (
                  <Textarea
                    className="text-xs"
                    value={parsed.skills.join(", ")}
                    id="skills"
                  />
                ) : (
                  <ul id="skills" className="grid list-disc pb-2 pl-2">
                    {parsed.skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div
                id="education"
                className="w-full border-b border-dotted border-[#737373] px-3 pb-3 leading-tight"
              >
                <h2 className="py-3 text-sm font-semibold uppercase tracking-[.15em]">
                  Education
                </h2>
                <div className="flex flex-col gap-2">
                  {parsed.education.map((school, index) => (
                    <Fragment key={school.schoolName}>
                      {isEditing.education[index]?.schoolName ? (
                        <Input
                          className="w-fit text-[1rem] font-semibold"
                          value={school.schoolName}
                          id="schoolName"
                        />
                      ) : (
                        <h3
                          id={`${index}.schoolName`}
                          className="text-[1rem] font-semibold"
                        >
                          {school.schoolName}
                        </h3>
                      )}

                      {isEditing.education[index]?.degree ? (
                        <Input
                          className="w-fit text-xs"
                          value={school.degree}
                          id="degree"
                        />
                      ) : (
                        <h4 id={`${index}.degree`} className="font-bold">
                          {school.degree}
                        </h4>
                      )}

                      <div>
                        {isEditing.education[index]?.startDate ? (
                          <Input
                            className="w-fit text-xs"
                            value={school.startDate}
                            id="startDate"
                          />
                        ) : (
                          <span id={`${index}.startDate`}>
                            school.startDate
                          </span>
                        )}{" "}
                        -{" "}
                        {isEditing.education[index]?.endDate ? (
                          <Input
                            className="w-fit text-xs"
                            value={school.endDate}
                            id="endDate"
                          />
                        ) : (
                          <span id={`${index}.endDate`}>school.endDate</span>
                        )}
                      </div>
                    </Fragment>
                  ))}
                </div>
              </div>

              <div id="interests" className="w-full px-3 pb-3">
                <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  Interests
                </h2>
                {isEditing.interests ? (
                  <Textarea
                    className="text-xs"
                    value={parsed.interests}
                    id="interests"
                  />
                ) : (
                  <p id="interests">{parsed.interests}</p>
                )}
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
                {isEditing.summary ? (
                  <Textarea
                    className="text-xs"
                    value={parsed.summary}
                    id="summary"
                  />
                ) : (
                  <p id="summary" className="pb-4">
                    {parsed.summary}
                  </p>
                )}
              </div>

              <div id="work">
                <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                  Work Experience
                </h2>

                <div className="flex max-h-full flex-col justify-between">
                  {parsed.experience.map((job, index) => (
                    <div className="pb-3" key={job.companyName + index}>
                      {isEditing.experience[index]?.title ? (
                        <Input
                          className="w-fit text-[1rem] font-semibold"
                          value={job.title}
                        />
                      ) : (
                        <h3
                          id={`title.${index}`}
                          className="pb-2 text-[1rem] font-semibold"
                        >
                          {job.title}
                        </h3>
                      )}

                      <div className="flex justify-between pb-2">
                        {isEditing.experience[index]?.companyName ? (
                          <Input
                            className="w-fit text-xs"
                            value={job.companyName}
                            id="companyName"
                          />
                        ) : (
                          <p id={`companyName.${index}`}>{job.companyName}</p>
                        )}
                        <div className="flex w-max">
                          {isEditing.experience[index]?.startDate ? (
                            <Input
                              className="w-fit text-xs"
                              value={job.startDate}
                              id="startDate"
                            />
                          ) : (
                            <span id={`startDate.${index}`}>
                              {job.startDate}
                            </span>
                          )}{" "}
                          -{" "}
                          {isEditing.experience[index]?.endDate ? (
                            <Input
                              className="w-fit text-xs"
                              value={job.endDate}
                              id="endDate"
                            />
                          ) : (
                            <span id={`endDate.${index}`}>{job.endDate}</span>
                          )}
                        </div>
                      </div>

                      {isEditing.experience[index]?.description ? (
                        <Textarea
                          className="text-xs"
                          value={job.description}
                          id="description"
                        />
                      ) : (
                        <ul
                          id={`description.${index}`}
                          className="ml-2 list-disc"
                        >
                          {job.description.split(". ").map((ka) => (
                            <li key={ka}>{ka}</li>
                          ))}
                        </ul>
                      )}
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

export type EditableFields = {
  skills: boolean
  interests: boolean
  profession: boolean
  linkedIn: boolean
  portfolio: boolean
  location: boolean
  phone: boolean
  firstName: boolean
  lastName: boolean
  email: boolean
  summary: boolean
  education: {
    schoolName: boolean
    degree: boolean
    startDate: boolean
    endDate: boolean
    description: boolean
    gpa: boolean
    location: boolean
  }[]
  experience: {
    title: boolean
    companyName: boolean
    startDate: boolean
    endDate: boolean
    description: boolean
  }[]
}
