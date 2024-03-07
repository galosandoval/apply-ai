import { Fragment } from "react"
import { type FinishedParsed } from "~/pages/dashboard"
import { type RouterOutputs } from "~/utils/api"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Button } from "./ui/button"
import { Cross1Icon } from "@radix-ui/react-icons"
import { type UseFormWatch, type UseFormRegister } from "react-hook-form"
import { type InsertResumeSchema } from "~/server/db/crud-schema"

export const Resume = ({
  data,
  hasIntro,
  hasPhone,
  hasLinkedIn,
  hasPortfolio,
  hasSkills,
  hasInterests
}: {
  data: RouterOutputs["resume"]["readById"] & {
    firstAndLastName: string
    email: string
    phone: string
    linkedIn?: string
    portfolio?: string
    location: string
  }
  hasIntro: boolean
  hasPhone: boolean
  hasLinkedIn: boolean
  hasPortfolio: boolean
  hasSkills: boolean
  hasInterests: boolean
}) => {
  return (
    <div className="h-[29.7cm] w-[21cm] bg-white px-20 py-16 text-[#727272]">
      <div className="flex h-full overflow-hidden">
        <div className="my-auto max-h-full border-b border-[#737373]">
          <div className="flex max-h-[100px] flex-col items-center gap-4 pb-2">
            <h1
              id="fullName"
              className="text-4xl font-semibold uppercase tracking-[.75rem]"
            ></h1>
            <h1
              id="profession"
              className="text-md mb-4 font-semibold uppercase tracking-[.25rem]"
            ></h1>
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
                {hasPhone && <p id="phone" className="pb-3"></p>}
                <p id="email" className="pb-3"></p>
                {hasLinkedIn && <p id="linkedIn" className="pb-3"></p>}
                {hasPortfolio && <p id="portfolio" className="pb-3"></p>}
                <address id="location" className="pb-4"></address>
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

              {hasInterests && (
                <div className="w-full px-3 pb-3">
                  <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                    Interests
                  </h2>
                  <p id="interests"></p>
                </div>
              )}
            </div>
            <div
              id="resume__right"
              className="flex w-[61.8%] flex-col overflow-hidden pl-4 text-[.65rem] leading-tight"
            >
              {hasIntro && (
                <div
                  id="profile"
                  className="border-b border-dotted border-[#737373] pr-2"
                >
                  <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
                    Profile
                  </h2>
                  <p id="introduction" className="pb-4"></p>
                </div>
              )}

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
                        <p>{job.name}</p>
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
  parsed,
  isEditing,
  fullName,
  watch,
  register,
  startEditing,
  finishEditing
}: {
  parsed: FinishedParsed
  isEditing: EditableFields
  fullName: string
  watch: UseFormWatch<InsertResumeSchema>
  register: UseFormRegister<InsertResumeSchema>
  startEditing: StartEditing
  finishEditing: () => void
}) => {
  const handleFinishEditingOnEscape = (
    e: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (e.key === "Escape" || e.key === "Enter") finishEditing()
  }

  const email = watch("email")
  const phone = watch("phone")
  const linkedIn = watch("linkedIn")
  const portfolio = watch("portfolio")
  const location = watch("location")
  const skills = watch("skills")
  const introduction = watch("introduction")
  const experience = watch("experience")
  const education = watch("education")
  const interests = watch("interests")
  const profession = watch("profession")

  return (
    <div
      onKeyDown={handleFinishEditingOnEscape}
      className="h-[29.7cm] w-[21cm] px-20 py-16"
    >
      <div className="flex h-full overflow-hidden">
        <div className="my-auto max-h-full border-b border-[#737373]">
          <Header
            profession={profession}
            fullName={fullName}
            isEditing={isEditing}
            register={register}
            startEditing={startEditing}
            finishEditing={finishEditing}
          />

          <div className="w-full border-b border-[#737373]" />

          <div className="flex h-full">
            {/* left */}
            <div className="flex w-[38.2%] flex-col bg-[#f8f8f8] text-[.65rem]">
              <Contact
                isEditing={isEditing}
                phone={phone}
                email={email}
                linkedIn={linkedIn}
                portfolio={portfolio}
                location={location}
                register={register}
                startEditing={startEditing}
                finishEditing={finishEditing}
              />

              <Skills
                isEditing={isEditing}
                skills={skills}
                register={register}
                startEditing={startEditing}
                finishEditing={finishEditing}
              />

              <Education
                isEditing={isEditing}
                register={register}
                education={education}
                startEditing={startEditing}
                finishEditing={finishEditing}
              />

              <Interests
                isEditing={isEditing}
                register={register}
                interests={interests}
                startEditing={startEditing}
                finishEditing={finishEditing}
              />
            </div>

            {/* right */}

            <div className="flex w-[61.8%] flex-col overflow-hidden pl-4 text-[.65rem] leading-tight">
              <Profile
                isEditing={isEditing}
                introduction={introduction}
                register={register}
                startEditing={startEditing}
                finishEditing={finishEditing}
              />

              <Experience
                isEditing={isEditing}
                experience={experience}
                register={register}
                startEditing={startEditing}
                finishEditing={finishEditing}
              />
            </div>
          </div>
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
  email: boolean
  summary: boolean
  education: {
    name: boolean
    degree: boolean
    startDate: boolean
    endDate: boolean
    description: boolean
    gpa: boolean
    location: boolean
  }[]
  experience: {
    title: boolean
    name: boolean
    startDate: boolean
    endDate: boolean
    description: boolean
  }[]
}

function Header({
  isEditing,
  fullName,
  profession,
  register,
  startEditing,
  finishEditing
}: {
  isEditing: EditableFields
  fullName: string
  profession: string
  register: UseFormRegister<InsertResumeSchema>
  startEditing: StartEditing
  finishEditing: () => void
}) {
  return (
    <div className="flex max-h-[100px] flex-col items-center gap-4 pb-2">
      <div className="flex gap-5 justify-self-center">
        <h1 className="rounded border border-transparent text-4xl font-semibold uppercase tracking-[.75rem]">
          {fullName}
        </h1>
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
          {profession}
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
  register,
  finishEditing,
  startEditing
}: {
  isEditing: EditableFields
  phone: string
  email: string
  linkedIn?: string
  portfolio?: string
  location: string
  register: UseFormRegister<InsertResumeSchema>
  startEditing: StartEditing
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
          <Input autoFocus className="text-xs" {...register("phone")} />

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
            {...register("email")}
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
          <Input autoFocus className="text-xs" {...register("linkedIn")} />

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
          <Input autoFocus className="text-xs" {...register("portfolio")} />

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
          <Input autoFocus className="text-xs" {...register("location")} />

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
  skills,
  register,
  finishEditing,
  startEditing
}: {
  isEditing: EditableFields
  skills?: string | null
  register: UseFormRegister<InsertResumeSchema>
  startEditing: StartEditing
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
          <Textarea className="text-xs" autoFocus {...register("skills")} />

          <Button
            onClick={finishEditing}
            className="z-10"
            variant="outline"
            size="icon"
          >
            <Cross1Icon />
          </Button>
        </div>
      ) : skills ? (
        <ul
          onClick={() => startEditing("skills")}
          className="grid cursor-pointer list-disc rounded border border-transparent pb-2 pl-2 hover:border-blue-800 hover:bg-sky-200"
        >
          {skills.split(", ").map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Education({
  isEditing,
  education,
  register,
  finishEditing,
  startEditing
}: {
  isEditing: EditableFields
  education: InsertResumeSchema["education"]
  register: UseFormRegister<InsertResumeSchema>
  startEditing: StartEditing
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
        {education.map((school, index) => (
          <Fragment key={school.name}>
            {isEditing.education[index]?.name ? (
              <div className="flex gap-1">
                <Input
                  autoFocus
                  className="w-fit text-[1rem] font-semibold"
                  {...register(`education.${index}.name`)}
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
                onClick={() => startEditing("education", index, "name")}
                className="cursor-pointer rounded border border-transparent text-[1rem] font-semibold hover:border-blue-800 hover:bg-sky-200"
              >
                {school.name}
              </h3>
            )}

            {isEditing.education[index]?.degree ? (
              <div className="flex gap-1">
                <Input autoFocus {...register(`education.${index}.degree`)} />

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
                    {...register(`education.${index}.startDate`)}
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
                    {...register(`education.${index}.endDate`)}
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
  interests,
  register,
  finishEditing,
  startEditing
}: {
  isEditing: EditableFields
  interests: string | null | undefined
  register: UseFormRegister<InsertResumeSchema>
  startEditing: StartEditing
  finishEditing: () => void
}) {
  return (
    <div id="interests" className="w-full px-3 pb-3">
      <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
        Interests
      </h2>
      {isEditing.interests ? (
        <div className="flex gap-1">
          <Textarea className="text-xs" autoFocus {...register("interests")} />

          <Button onClick={finishEditing} variant="outline" size="icon">
            <Cross1Icon />
          </Button>
        </div>
      ) : (
        <p
          onClick={() => startEditing("interests")}
          className="cursor-pointer rounded border border-transparent hover:border-blue-800 hover:bg-sky-200"
        >
          {interests}
        </p>
      )}
    </div>
  )
}

function Profile({
  isEditing,
  introduction,
  register,
  finishEditing,
  startEditing
}: {
  isEditing: EditableFields
  introduction: string | null | undefined
  register: UseFormRegister<InsertResumeSchema>
  startEditing: StartEditing
  finishEditing: () => void
}) {
  return (
    <div id="profile" className="border-b border-dotted border-[#737373] pr-2">
      <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
        Profile
      </h2>
      {isEditing.summary ? (
        <div className="flex gap-1">
          <Textarea
            autoFocus
            className="text-xs"
            {...register("introduction")}
          />

          <Button onClick={finishEditing} variant="outline" size="icon">
            <Cross1Icon />
          </Button>
        </div>
      ) : (
        <p
          onClick={() => startEditing("summary")}
          className="cursor-pointer rounded border border-transparent pb-4 hover:border-blue-800 hover:bg-sky-200"
        >
          {introduction}
        </p>
      )}
    </div>
  )
}

type StartEditing = (
  id: keyof EditableFields,
  index?: number,
  key?:
    | keyof EditableFields["experience"][number]
    | keyof EditableFields["education"][number]
) => void

function Experience({
  isEditing,
  experience,
  finishEditing,
  startEditing,
  register
}: {
  isEditing: EditableFields
  experience: InsertResumeSchema["experience"]
  startEditing: StartEditing
  finishEditing: () => void
  register: UseFormRegister<InsertResumeSchema>
}) {
  return (
    <div id="work">
      <h2 className="py-3 text-[1rem] font-semibold uppercase tracking-[.15em]">
        Work Experience
      </h2>

      <div className="flex max-h-full flex-col justify-between">
        {experience.map((job, index) => (
          <Job
            key={`${job.name}_${index}`}
            index={index}
            isEditing={isEditing}
            data={job}
            finishEditing={finishEditing}
            startEditing={startEditing}
            register={register}
          />
        ))}
      </div>
    </div>
  )
}

function Job({
  isEditing,
  index,
  data,
  startEditing,
  finishEditing,
  register
}: {
  isEditing: EditableFields
  index: number
  data: InsertResumeSchema["experience"][number]
  finishEditing: () => void
  startEditing: StartEditing
  register: UseFormRegister<InsertResumeSchema>
}) {
  return (
    <div className="pb-3">
      {isEditing.experience[index]?.title ? (
        <div className="flex gap-1">
          <Input
            autoFocus
            className="w-fit text-[1rem] font-semibold"
            {...register(`experience.${index}.title`)}
          />

          <Button onClick={finishEditing} variant="outline" size="icon">
            <Cross1Icon />
          </Button>
        </div>
      ) : (
        <h3
          onClick={() => startEditing("experience", index, "title")}
          className="cursor-pointer rounded border border-transparent pb-2 text-[1rem] font-semibold hover:border-blue-800 hover:bg-sky-200"
        >
          {data.title}
        </h3>
      )}

      <div className="flex justify-between pb-2">
        {isEditing.experience[index]?.name ? (
          <div className="flex gap-1">
            <Input
              autoFocus
              className="w-fit text-xs"
              {...register(`experience.${index}.name`)}
            />

            <Button onClick={finishEditing} variant="outline" size="icon">
              <Cross1Icon />
            </Button>
          </div>
        ) : (
          <span
            className="cursor-pointer rounded border border-transparent hover:border-blue-800 hover:bg-sky-200"
            onClick={() => startEditing("experience", index, "name")}
          >
            {data.name}
          </span>
        )}

        <div className="flex w-max gap-1">
          {isEditing.experience[index]?.startDate ? (
            <div className="flex gap-1">
              <Input
                autoFocus
                className="w-fit text-xs"
                {...register(`experience.${index}.startDate`)}
              />
              <Button onClick={finishEditing} variant="outline" size="icon">
                <Cross1Icon />
              </Button>
            </div>
          ) : (
            <span
              className="cursor-pointer rounded border border-transparent hover:border-blue-800 hover:bg-sky-200"
              onClick={() => startEditing("experience", index, "startDate")}
            >
              {data.startDate}
            </span>
          )}
          <span> - </span>
          {isEditing.experience[index]?.endDate ? (
            <div className="flex gap-1">
              <Input
                autoFocus
                className="w-fit text-xs"
                {...register(`experience.${index}.endDate`)}
              />

              <Button onClick={finishEditing} variant="outline" size="icon">
                <Cross1Icon />
              </Button>
            </div>
          ) : (
            <span
              className="cursor-pointer rounded border border-transparent hover:border-blue-800 hover:bg-sky-200"
              onClick={() => startEditing("experience", index, "endDate")}
            >
              {data.endDate}
            </span>
          )}
        </div>
      </div>

      {isEditing.experience[index]?.description ? (
        <div className="flex gap-1">
          <Textarea
            className="text-xs"
            autoFocus
            {...register(`experience.${index}.description`)}
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
          {data.description.split(". ").map((ka) => (
            <li key={ka}>{ka}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
