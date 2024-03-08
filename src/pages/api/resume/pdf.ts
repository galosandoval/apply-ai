import type { NextApiRequest, NextApiResponse } from "next"
import puppeteer, { type Page } from "puppeteer"
import { env } from "~/env.mjs"
import { downloadPdfSchema } from "~/server/db/crud-schema"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Buffer>
) {
  const {
    fullName,
    resumeId,
    profession,
    email,
    location,
    introduction,
    phone,
    linkedIn,
    portfolio,
    skills,
    interests
  } = downloadPdfSchema.parse(req.body)

  try {
    const browser = await puppeteer.launch({ headless: "new" })
    const page = await browser.newPage()

    await page.goto(env.NEXTAUTH_URL + `/login`, {
      waitUntil: "networkidle2"
    })

    await page.type("#email", "galosan@gmail.com")
    await page.type("#password", "Admin@123")

    await page.click("#login-btn")
    await page.waitForNavigation()

    await page.goto(
      env.NEXTAUTH_URL +
        `/resume/${resumeId}?skillsCount=${
          skills.split(", ").length
        }&hasIntro=${!!introduction}&hasPhone=${!!phone}&hasLinkedIn=${!!linkedIn}&hasPortfolio=${!!portfolio}&hasSkills=${!!skills}&hasInterests=${!!interests}`,
      {
        waitUntil: "networkidle0"
      }
    )

    await insertValuesOnPage(
      page,
      fullName,
      profession,
      email,
      location,
      introduction,
      phone,
      linkedIn,
      portfolio,
      skills,
      interests
    )

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

async function insertValuesOnPage(
  page: Page,
  fullName: string,
  profession: string,
  email: string,
  location: string,
  introduction: string | null | undefined,
  phone: string | null | undefined,
  linkedIn: string | null | undefined,
  portfolio: string | null | undefined,
  skills: string,
  interests: string | null | undefined
) {
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
