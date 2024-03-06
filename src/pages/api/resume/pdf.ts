import type { NextApiRequest, NextApiResponse } from "next"
import puppeteer from "puppeteer"
import { env } from "~/env.mjs"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Buffer>
) {
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

    await page.goto(env.NEXTAUTH_URL + `/resume/${req.body.resumeId}`, {
      waitUntil: "networkidle0"
    })

    await page.$$eval(
      "#fullname",
      (links, value) => links.forEach((el) => (el.innerHTML = value)),
      "myLocalValue"
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
