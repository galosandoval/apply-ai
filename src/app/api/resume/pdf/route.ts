import { type NextRequest } from "next/server"
import { getServerAuthSession } from "~/server/auth"
import { downloadPdfSchema } from "~/server/db/crud-schema"
import { renderResumePdf } from "~/server/modules/profile/render-resume-pdf"

/** Chromium needs a real Node runtime; the edge runtime cannot spawn it. */
export const runtime = "nodejs"

/**
 * A cold instance unpacks Chromium to /tmp before it can print, which the
 * default 10s does not cover. Vercel's Hobby ceiling is 60s; Pro allows more.
 */
export const maxDuration = 60

/** Launching a browser is expensive enough that it doesn't run for strangers. */
export async function POST(req: NextRequest) {
  const session = await getServerAuthSession(req.headers)

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const parsed = downloadPdfSchema.safeParse(await req.json())

  if (!parsed.success) {
    return Response.json({ errors: parsed.error.flatten() }, { status: 400 })
  }

  const pdf = await renderResumePdf(parsed.data)

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="resume.pdf"'
    }
  })
}
