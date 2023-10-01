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
    await page.goto(env.NEXTAUTH_URL + `/resume/${req.body.resumeId}`, {
      waitUntil: "networkidle0"
    })
    const pdf = await page.pdf({ format: "A4" })

    await browser.close()
    res.setHeader("Content-Type", "application/pdf")
    res.status(200).send(pdf)
  } catch (error) {
    if (error instanceof Error) throw new Error(error.message)

    throw new Error(
      "Something went wrong, could not create PDF, please try again."
    )
  }
}
