import { Fragment } from "react"
import { type FinishedParsed } from "~/pages/dashboard"
import { type RouterOutputs } from "~/utils/api"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Button } from "./ui/button"
import { Cross1Icon } from "@radix-ui/react-icons"
import { type UseFormRegister } from "react-hook-form"
import { type InsertResumeSchema } from "~/server/db/crud-schema"

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
  isEditing,
  register,
  startEditing,
  finishEditing
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
  register: UseFormRegister<InsertResumeSchema>
  startEditing: (
    id: keyof typeof isEditing,
    index?: number,
    key?:
      | keyof (typeof isEditing.experience)[number]
      | keyof (typeof isEditing.education)[number]
  ) => void
  finishEditing: () => void
}) => {
  const handleFinishEditingOnEscape = (
    e: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (e.key === "Escape") finishEditing()
  }

  return (
    <div
      className="h-[29.7cm] w-[21cm] px-20 py-16"
      onKeyDown={handleFinishEditingOnEscape}
    >
      <div className="flex h-full overflow-hidden">
        <div className="my-auto max-h-full border-b border-[#737373]">
          <Header
            parsed={parsed}
            firstName={firstName}
            isEditing={isEditing}
            lastName={lastName}
            register={register}
            startEditing={startEditing}
            finishEditing={finishEditing}
          />

          <div className="w-full border-b border-[#737373]" />
          <section className="flex h-full">
            <div
              id="resume__left"
              className="flex w-[38.2%] flex-col bg-[#f8f8f8] text-[.65rem]"
            >
              <Contact
                isEditing={isEditing}
                phone={phone}
                email={email}
                linkedIn={linkedIn}
                portfolio={portfolio}
                location={location}
                startEditing={startEditing}
                finishEditing={finishEditing}
              />

              <Skills
                isEditing={isEditing}
                parsed={parsed}
                startEditing={startEditing}
                finishEditing={finishEditing}
              />

              <Education
                isEditing={isEditing}
                parsed={parsed}
                startEditing={startEditing}
                finishEditing={finishEditing}
              />

              <Interests
                isEditing={isEditing}
                parsed={parsed}
                startEditing={startEditing}
                finishEditing={finishEditing}
              />
            </div>
            <div
              id="resume__right"
              className="flex w-[61.8%] flex-col overflow-hidden pl-4 text-[.65rem] leading-tight"
            >
              <Profile
                isEditing={isEditing}
                parsed={parsed}
                startEditing={startEditing}
                finishEditing={finishEditing}
              />

              <Experience
                parsed={parsed}
                isEditing={isEditing}
                startEditing={startEditing}
                finishEditing={finishEditing}
              />
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

function Header({
  isEditing,
  firstName,
  lastName,
  parsed,
  register,
  startEditing,
  finishEditing
}: {
  isEditing: EditableFields
  firstName: string
  lastName: string
  parsed: FinishedParsed
  register: UseFormRegister<InsertResumeSchema>
  startEditing: (
    id: keyof typeof isEditing,
    index?: number,
    key?:
      | keyof (typeof isEditing.experience)[number]
      | keyof (typeof isEditing.education)[number]
  ) => void
  finishEditing: () => void
}) {
  return (
    <div className="flex max-h-[100px] flex-col items-center gap-4 pb-2">
      <div className="flex gap-5 justify-self-center">
        {isEditing.firstName ? (
          <div className="flex justify-end gap-1">
            <Input
              className="w-1/2 text-4xl font-semibold uppercase tracking-[.75rem]"
              autoFocus
              {...register("firstName")}
            />

            <Button onClick={finishEditing} variant="outline" size="icon">
              <Cross1Icon />
            </Button>
          </div>
        ) : (
          <h1
            onClick={() => startEditing("firstName")}
            className="cursor-pointer rounded border border-transparent text-4xl font-semibold uppercase tracking-[.75rem] hover:border-blue-800 hover:bg-sky-200"
          >
            {firstName}
          </h1>
        )}
        {isEditing.lastName ? (
          <div className="flex justify-start gap-1">
            <Input
              className="w-1/2 text-4xl font-semibold uppercase tracking-[.75rem]"
              autoFocus
              {...register("lastName")}
            />

            <Button onClick={finishEditing} variant="outline" size="icon">
              <Cross1Icon />
            </Button>
          </div>
        ) : (
          <h1
            onClick={() => startEditing("lastName")}
            className="cursor-pointer rounded border border-transparent text-4xl font-semibold uppercase tracking-[.75rem] hover:border-blue-800 hover:bg-sky-200"
          >
            {lastName}
          </h1>
        )}
      </div>

      {isEditing.profession ? (
        <div className="flex justify-start gap-1">
          <Input
            autoFocus
            className="text-md mb-4 w-fit border border-transparent font-semibold uppercase tracking-[.25rem]"
            {...register("profession")}
          />

          <Button onClick={finishEditing} variant="outline" size="icon">
            <Cross1Icon />
          </Button>
        </div>
      ) : (
        <h1
          id="profession"
          className="text-md mb-4 cursor-pointer rounded border border-transparent font-semibold uppercase tracking-[.25rem] hover:border-blue-800 hover:bg-sky-200"
          onClick={() => startEditing("profession")}
        >
          {parsed.profession}
        </h1>
      )}
    </div>
  )
}

function Contact({
  isEditing,
  phone,
  email,
  linkedIn,
  portfolio,
  location,
  finishEditing,
  startEditing
}: {
  isEditing: EditableFields
  phone: string
  email: string
  linkedIn?: string
  portfolio?: string
  location: string
  startEditing: (
    id: keyof typeof isEditing,
    index?: number,
    key?:
      | keyof (typeof isEditing.experience)[number]
      | keyof (typeof isEditing.education)[number]
  ) => void
  finishEditing: () => void
}) {
  return (
    <div
      id="contact"
      className="w-full border-b border-dotted border-[#737373] px-3"
    >
      <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
        Contact
      </h2>
      {isEditing.phone ? (
        <div className="">
          <Input autoFocus className="text-xs" value={phone} />

          <Button
            onClick={finishEditing}
            className="z-10"
            variant="outline"
            size="icon"
          >
            <Cross1Icon />
          </Button>
        </div>
      ) : (
        <p
          onClick={() => startEditing("phone")}
          className="cursor-pointer rounded border border-transparent pb-3 hover:border-blue-800 hover:bg-sky-200"
        >
          {phone}
        </p>
      )}

      {isEditing.email ? (
        <div className="flex gap-1">
          <Input
            autoFocus
            className="rounded border border-transparent text-xs"
            value={email}
          />

          <Button
            onClick={finishEditing}
            className="z-10"
            variant="outline"
            size="icon"
          >
            <Cross1Icon />
          </Button>
        </div>
      ) : (
        <p
          onClick={() => startEditing("email")}
          className="cursor-pointer rounded border border-transparent pb-3 hover:border-blue-800 hover:bg-sky-200"
        >
          {email}
        </p>
      )}

      {isEditing.linkedIn ? (
        <div className="flex gap-1">
          <Input autoFocus className="text-xs" value={linkedIn} id="linkedIn" />

          <Button
            onClick={finishEditing}
            className="z-10"
            variant="outline"
            size="icon"
          >
            <Cross1Icon />
          </Button>
        </div>
      ) : (
        <p
          onClick={() => startEditing("linkedIn")}
          className="cursor-pointer rounded border border-transparent pb-3 hover:border-blue-800 hover:bg-sky-200"
        >
          {linkedIn}
        </p>
      )}

      {isEditing.portfolio ? (
        <div className="flex gap-1">
          <Input autoFocus className="text-xs" value={portfolio} />

          <Button
            onClick={finishEditing}
            className="z-10"
            variant="outline"
            size="icon"
          >
            <Cross1Icon />
          </Button>
        </div>
      ) : (
        <p
          onClick={() => startEditing("portfolio")}
          className="cursor-pointer rounded border border-transparent pb-3 hover:border-blue-800 hover:bg-sky-200"
        >
          {portfolio}
        </p>
      )}

      {isEditing.location ? (
        <div className="flex gap-1">
          <Input autoFocus className="text-xs" value={location} id="location" />

          <Button
            onClick={finishEditing}
            className="z-10"
            variant="outline"
            size="icon"
          >
            <Cross1Icon />
          </Button>
        </div>
      ) : (
        <address
          onClick={() => startEditing("location")}
          className="cursor-pointer rounded border border-transparent pb-4 hover:border-blue-800 hover:bg-sky-200"
        >
          {location}
        </address>
      )}
    </div>
  )
}

function Skills({
  isEditing,
  parsed,
  finishEditing,
  startEditing
}: {
  isEditing: EditableFields
  parsed: FinishedParsed
  startEditing: (
    id: keyof typeof isEditing,
    index?: number,
    key?:
      | keyof (typeof isEditing.experience)[number]
      | keyof (typeof isEditing.education)[number]
  ) => void
  finishEditing: () => void
}) {
  return (
    <div
      id="skills"
      className="w-full border-b border-dotted border-[#737373] px-2 leading-tight"
    >
      <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
        skills
      </h2>
      {isEditing.skills ? (
        <div className="flex gap-1">
          <Textarea
            className="text-xs"
            value={parsed.skills.join(", ")}
            autoFocus
          />

          <Button
            onClick={finishEditing}
            className="z-10"
            variant="outline"
            size="icon"
          >
            <Cross1Icon />
          </Button>
        </div>
      ) : (
        <ul
          onClick={() => startEditing("skills")}
          className="grid cursor-pointer list-disc rounded border border-transparent pb-2 pl-2 hover:border-blue-800 hover:bg-sky-200"
        >
          {parsed.skills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Education({
  isEditing,
  parsed,
  finishEditing,
  startEditing
}: {
  isEditing: EditableFields
  parsed: FinishedParsed
  startEditing: (
    id: keyof typeof isEditing,
    index?: number,
    key?:
      | keyof (typeof isEditing.experience)[number]
      | keyof (typeof isEditing.education)[number]
  ) => void
  finishEditing: () => void
}) {
  return (
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
              <div className="flex gap-1">
                <Input
                  autoFocus
                  className="w-fit text-[1rem] font-semibold"
                  value={school.schoolName}
                />

                <Button
                  onClick={finishEditing}
                  className="z-10"
                  variant="outline"
                  size="icon"
                >
                  <Cross1Icon />
                </Button>
              </div>
            ) : (
              <h3
                onClick={() => startEditing("education", index, "schoolName")}
                className="cursor-pointer rounded border border-transparent text-[1rem] font-semibold hover:border-blue-800 hover:bg-sky-200"
              >
                {school.schoolName}
              </h3>
            )}

            {isEditing.education[index]?.degree ? (
              <div className="flex gap-1">
                <Input
                  autoFocus
                  className="text-xs font-bold"
                  value={school.degree}
                />

                <Button onClick={finishEditing} variant="outline" size="icon">
                  <Cross1Icon />
                </Button>
              </div>
            ) : (
              <h4
                onClick={() => startEditing("education", index, "degree")}
                className="cursor-pointer rounded border border-transparent font-bold hover:border-blue-800 hover:bg-sky-200"
              >
                {school.degree}
              </h4>
            )}

            <div>
              {isEditing.education[index]?.startDate ? (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    className="w-1/2 text-xs"
                    value={school.startDate}
                  />

                  <Button onClick={finishEditing} variant="outline" size="icon">
                    <Cross1Icon />
                  </Button>
                </div>
              ) : (
                <span
                  onClick={() => startEditing("education", index, "startDate")}
                  className="cursor-pointer rounded border border-transparent hover:border-blue-800 hover:bg-sky-200"
                >
                  {school.startDate}
                </span>
              )}{" "}
              -{" "}
              {isEditing.education[index]?.endDate ? (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    className="w-1/2 text-xs"
                    value={school.endDate}
                  />

                  <Button onClick={finishEditing} variant="outline" size="icon">
                    <Cross1Icon />
                  </Button>
                </div>
              ) : (
                <span
                  className="cursor-pointer rounded border border-transparent hover:border-blue-800 hover:bg-sky-200"
                  onClick={() => startEditing("education", index, "endDate")}
                >
                  {school.endDate}
                </span>
              )}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function Interests({
  isEditing,
  parsed,
  finishEditing,
  startEditing
}: {
  isEditing: EditableFields
  parsed: FinishedParsed
  startEditing: (
    id: keyof typeof isEditing,
    index?: number,
    key?:
      | keyof (typeof isEditing.experience)[number]
      | keyof (typeof isEditing.education)[number]
  ) => void
  finishEditing: () => void
}) {
  return (
    <div id="interests" className="w-full px-3 pb-3">
      <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
        Interests
      </h2>
      {isEditing.interests ? (
        <div className="flex gap-1">
          <Textarea className="text-xs" value={parsed.interests} autoFocus />

          <Button onClick={finishEditing} variant="outline" size="icon">
            <Cross1Icon />
          </Button>
        </div>
      ) : (
        <p
          onClick={() => startEditing("interests")}
          className="cursor-pointer rounded border border-transparent hover:border-blue-800 hover:bg-sky-200"
        >
          {parsed.interests}
        </p>
      )}
    </div>
  )
}

function Profile({
  isEditing,
  parsed,
  finishEditing,
  startEditing
}: {
  isEditing: EditableFields
  parsed: FinishedParsed
  startEditing: (
    id: keyof typeof isEditing,
    index?: number,
    key?:
      | keyof (typeof isEditing.experience)[number]
      | keyof (typeof isEditing.education)[number]
  ) => void
  finishEditing: () => void
}) {
  return (
    <div id="profile" className="border-b border-dotted border-[#737373] pr-2">
      <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
        Profile
      </h2>
      {isEditing.summary ? (
        <div className="flex gap-1">
          <Textarea autoFocus className="text-xs" value={parsed.summary} />

          <Button onClick={finishEditing} variant="outline" size="icon">
            <Cross1Icon />
          </Button>
        </div>
      ) : (
        <p
          onClick={() => startEditing("summary")}
          className="cursor-pointer rounded border border-transparent pb-4 hover:border-blue-800 hover:bg-sky-200"
        >
          {parsed.summary}
        </p>
      )}
    </div>
  )
}

function Experience({
  parsed,
  isEditing,
  finishEditing,
  startEditing
}: {
  parsed: FinishedParsed
  isEditing: EditableFields
  startEditing: (
    id: keyof typeof isEditing,
    index?: number,
    key?:
      | keyof (typeof isEditing.experience)[number]
      | keyof (typeof isEditing.education)[number]
  ) => void
  finishEditing: () => void
}) {
  return (
    <div id="work">
      <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
        Work Experience
      </h2>

      <div className="flex max-h-full flex-col justify-between">
        {parsed.experience.map((job, index) => (
          <div className="pb-3" key={job.companyName + index}>
            {isEditing.experience[index]?.title ? (
              <div className="flex gap-1">
                <Input
                  autoFocus
                  className="w-fit text-[1rem] font-semibold"
                  value={job.title}
                />

                <Button onClick={finishEditing} variant="outline" size="icon">
                  <Cross1Icon />
                </Button>
              </div>
            ) : (
              <h3
                onClick={() => startEditing("experience", index, "title")}
                id={`title.${index}`}
                className="cursor-pointer rounded border border-transparent pb-2 text-[1rem] font-semibold hover:border-blue-800 hover:bg-sky-200"
              >
                {job.title}
              </h3>
            )}

            <div className="flex justify-between pb-2">
              {isEditing.experience[index]?.companyName ? (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    className="w-fit text-xs"
                    value={job.companyName}
                    id="companyName"
                  />

                  <Button onClick={finishEditing} variant="outline" size="icon">
                    <Cross1Icon />
                  </Button>
                </div>
              ) : (
                <p
                  className="cursor-pointer rounded border border-transparent hover:border-blue-800 hover:bg-sky-200"
                  onClick={() =>
                    startEditing("experience", index, "companyName")
                  }
                >
                  {job.companyName}
                </p>
              )}
              <div className="flex w-max gap-1">
                {isEditing.experience[index]?.startDate ? (
                  <div className="flex gap-1">
                    <Input
                      autoFocus
                      className="w-fit text-xs"
                      value={job.startDate}
                      id="startDate"
                    />
                    <Button
                      onClick={finishEditing}
                      variant="outline"
                      size="icon"
                    >
                      <Cross1Icon />
                    </Button>
                  </div>
                ) : (
                  <span
                    className="cursor-pointer rounded border border-transparent hover:border-blue-800 hover:bg-sky-200"
                    onClick={() =>
                      startEditing("experience", index, "startDate")
                    }
                  >
                    {job.startDate}
                  </span>
                )}
                <span> - </span>
                {isEditing.experience[index]?.endDate ? (
                  <div className="flex gap-1">
                    <Input
                      autoFocus
                      className="w-fit text-xs"
                      value={job.endDate}
                      id="endDate"
                    />

                    <Button
                      onClick={finishEditing}
                      variant="outline"
                      size="icon"
                    >
                      <Cross1Icon />
                    </Button>
                  </div>
                ) : (
                  <span
                    className="cursor-pointer rounded border border-transparent hover:border-blue-800 hover:bg-sky-200"
                    onClick={() => startEditing("experience", index, "endDate")}
                  >
                    {job.endDate}
                  </span>
                )}
              </div>
            </div>

            {isEditing.experience[index]?.description ? (
              <div className="flex gap-1">
                <Textarea
                  className="text-xs"
                  value={job.description}
                  autoFocus
                />

                <Button onClick={finishEditing} variant="outline" size="icon">
                  <Cross1Icon />
                </Button>
              </div>
            ) : (
              <ul
                onClick={() => startEditing("experience", index, "description")}
                className="ml-2 cursor-pointer list-disc rounded border border-transparent hover:border-blue-800 hover:bg-sky-200"
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
  )
}
