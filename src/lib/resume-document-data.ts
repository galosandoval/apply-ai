import { type ResumeDocumentData } from "~/components/resume-document"
import { type RouterOutputs } from "~/utils/api"

/**
 * Seeds a *new* resume's contact and skills from the account's master copy.
 *
 * Only the draft preview uses this: it is editing a resume that does not exist
 * yet, so there is no snapshot to read. A saved resume owns its own copy and
 * never reads through to the account — that is what stops tailoring one
 * application from rewriting one already sent.
 *
 * The optional contact fields come back as `""` rather than `undefined`: the
 * document tolerates either, but the draft form's inputs must stay controlled.
 */
export function seedFromAccount(
  profile: RouterOutputs["profile"]["read"]
): Pick<ResumeDocumentData, "contact" | "skill"> {
  return {
    contact: {
      fullName: `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim(),
      email: profile.email,
      location: profile.contact?.location ?? "",
      phone: profile.contact?.phone ?? "",
      linkedIn: profile.contact?.linkedIn ?? "",
      portfolio: profile.contact?.portfolio ?? ""
    },
    // Stored one entry per row, rendered as a single comma-separated line.
    skill: profile.skills.map((group) => ({
      id: group.id,
      category: group.category,
      all: group.all.join(", ")
    }))
  }
}
