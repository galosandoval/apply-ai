import { type NextRequest } from "next/server"
import { getServerAuthSession } from "~/server/auth"
import { downloadPdfSchema } from "~/server/db/crud-schema"
import { renderResumePdf } from "~/server/modules/profile/render-resume-pdf"

/** Chromium and the filesystem read of the built stylesheet need a real Node. */
export const runtime = "nodejs"

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
