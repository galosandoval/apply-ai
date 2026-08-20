import { type RouterOutputs } from "~/utils/api"

/**
 * The half of the document the profile owns, rather than the resume.
 *
 * The editor and the draft preview assemble their resume halves differently —
 * one from a saved snapshot, one from form state — but both need these fields
 * built the same way, and they drifted when each built them itself.
 *
 * The optional contact fields come back as `""` rather than `undefined`: the
 * document tolerates either, but the draft form's inputs must stay controlled.
 */
export function profileDocumentFields(
  profile: RouterOutputs["profile"]["read"]
) {
  return {
    fullName: `${profile.firstName} ${profile.lastName}`,
    email: profile.email,
    location: profile.contact?.location ?? "",
    phone: profile.contact?.phone ?? "",
    linkedIn: profile.contact?.linkedIn ?? "",
    portfolio: profile.contact?.portfolio ?? "",
    // Stored one skill per row, rendered as a single comma-separated line.
    skills: profile.skills.map((skill) => ({
      ...skill,
      all: skill.all.join(", ")
    }))
  }
}
