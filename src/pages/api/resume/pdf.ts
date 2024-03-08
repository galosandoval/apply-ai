import type { NextApiRequest, NextApiResponse } from "next"
import puppeteer, { type Page } from "puppeteer"
import { env } from "~/env.mjs"
import {
  type DownloadPdfSchema,
  downloadPdfSchema
} from "~/server/db/crud-schema"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Buffer>
) {
  const input = downloadPdfSchema.parse(req.body)

  try {
    const browser = await puppeteer.launch({ headless: "new" })
    const page = await browser.newPage()

    const endpoint = createEndpoint(input)

    await page.goto(env.NEXTAUTH_URL + endpoint, {
      waitUntil: "networkidle0"
    })

    await insertValuesOnPage(page, input)

    const pdf = await page.pdf({ format: "A4" })

    await browser.close()
    res.setHeader("Content-Type", "application/pdf")
    res.status(200).send(pdf)
  } catch (error) {
    console.error(error)

    if (error instanceof Error) throw new Error(error.message)

    throw new Error(
      "Something went wrong, could not create PDF, please try again."
    )
  }
}

function createEndpoint(input: DownloadPdfSchema) {
  const skillsCount = input.skills.split(", ").length
  const educationCount = input.education.length
  const experienceCount = input.experience.length
  const expDescriptionCount: Record<string, number> = {}

  input.experience.forEach((job, index) => {
    expDescriptionCount[`desc${index}`] = job.description.split(". ").length
  })

  let endpoint = `/pdf?skillsCount=${skillsCount}&eduCount=${educationCount}&expCount=${experienceCount}&hasIntro=${!!input.introduction}&hasPhone=${!!input.phone}&hasLinkedIn=${!!input.linkedIn}&hasPortfolio=${!!input.portfolio}&hasInterests=${!!input.interests}`

  for (const [key, value] of Object.entries(expDescriptionCount)) {
    if (value > 1) {
      endpoint += `&${key}=${value}`
    }
  }

  return endpoint
}

async function insertValuesOnPage(page: Page, values: DownloadPdfSchema) {
  const {
    fullName,
    profession,
    email,
    location,
    skills,
    introduction,
    phone,
    linkedIn,
    portfolio,
    interests,
    education,
    experience
  } = values

  const promises: Promise<void>[] = []

  promises.push(
    page.$$eval(
      "#fullName",
      (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
      fullName
    )
  )

  promises.push(
    page.$$eval(
      "#profession",
      (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
      profession
    )
  )

  promises.push(
    page.$$eval(
      "#email",
      (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
      email
    )
  )

  promises.push(
    page.$$eval(
      "#location",
      (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
      location
    )
  )

  skills.split(", ").forEach((skill, index) => {
    promises.push(
      page.$$eval(
        `#skill-${index}`,
        (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
        skill
      )
    )
  })

  education.forEach((school, index) => {
    promises.push(
      page.$$eval(
        `#school-${index}-degree`,
        (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
        school.degree
      )
    )

    promises.push(
      page.$$eval(
        `#school-${index}-name`,
        (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
        school.name
      )
    )

    promises.push(
      page.$$eval(
        `#school-${index}-duration`,
        (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
        `${school.startDate} - ${school.endDate}`
      )
    )

    if (school.description) {
      promises.push(
        page.$$eval(
          `#school-${index}-description`,
          (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
          school.description
        )
      )
    }
  })

  experience.forEach((job, index) => {
    promises.push(
      page.$$eval(
        `#job-${index}-title`,
        (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
        job.title
      )
    )

    promises.push(
      page.$$eval(
        `#job-${index}-name`,
        (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
        job.name
      )
    )

    promises.push(
      page.$$eval(
        `#job-${index}-duration`,
        (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
        `${job.startDate} - ${job.endDate}`
      )
    )

    job.description.split(". ").forEach((sentence, i) => {
      promises.push(
        page.$$eval(
          `#job-${index}-desc-${i}`,
          (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
          sentence
        )
      )
    })
  })

  // optional fields
  if (introduction) {
    promises.push(
      page.$$eval(
        "#introduction",
        (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
        introduction
      )
    )
  }

  if (phone) {
    promises.push(
      page.$$eval(
        "#phone",
        (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
        phone
      )
    )
  }

  if (linkedIn) {
    promises.push(
      page.$$eval(
        "#linkedIn",
        (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
        linkedIn
      )
    )
  }

  if (portfolio) {
    promises.push(
      page.$$eval(
        "#portfolio",
        (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
        portfolio
      )
    )
  }

  if (interests) {
    promises.push(
      page.$$eval(
        "#interests",
        (elements, value) => elements.forEach((el) => (el.innerHTML = value)),
        interests
      )
    )
  }

  await Promise.all(promises)
}
