/**
 * One crumb on the trail: contact, the one step that is not a section — its
 * label is copy, resolved from `onboarding.steps` where the trail is drawn —
 * or one of the account's own sections, carrying whatever heading is stored
 * on it.
 *
 * One shape for both rather than a union, so the trail draws the list with a
 * single `.map`. `kind` and `label` are `null` together, and only for
 * contact. `kind` is the stored column's own type — `text`, so `string` — not
 * `SectionKind`: this module only ever displays it, and narrowing it is the
 * concern of whatever reads it to decide how a step renders.
 */
export type OnboardingStep = {
  id: string
  kind: string | null
  label: string | null
}

/** The shape `deriveOnboardingSteps` reads off a profile — nothing more. */
export type OnboardingProfile = {
  sections: { id: string; kind: string; label: string }[]
}

const contactStep: OnboardingStep = { id: "contact", kind: null, label: null }

/**
 * The onboarding trail, derived from the profile rather than fixed as a step
 * tuple: contact first, then the account's own sections in their stored
 * order and under their stored labels.
 *
 * A pure projection over `profile.sections` — it makes no decision about what
 * that order or those labels are. An imported profile's sections already
 * arrive in the document's order under the document's headings
 * (`replaceImportedSections` writes them that way), and a profile with none
 * of its own reads as the required set, the same fallback
 * `readAccountSections` gives everywhere else a profile's sections are read.
 * Adding a section kind is a change to what produces `sections`, never a line
 * here.
 */
export function deriveOnboardingSteps(
  profile: OnboardingProfile
): OnboardingStep[] {
  return [
    contactStep,
    ...profile.sections.map(
      (section): OnboardingStep => ({
        id: section.id,
        kind: section.kind,
        label: section.label
      })
    )
  ]
}

/**
 * The step after `currentKey` in the derived trail, or `null` past the last
 * one — or for a key the trail does not carry at all.
 *
 * Onboarding used to advance by naming the next step outright: contact always
 * went to education, education always to experience. That stopped being true
 * the moment the trail was derived rather than fixed — the account's own
 * order decides what follows a step, and a step that named its neighbour
 * would be naming a section that might not be next, or might not be on the
 * account at all. So a step advances by finding its own place in the same
 * list the trail draws, which is the one thing that cannot disagree with what
 * the trail shows.
 */
export function nextOnboardingStep(
  profile: OnboardingProfile,
  currentKey: string
): string | null {
  const keys = deriveOnboardingSteps(profile).map(onboardingPanelKey)
  const index = keys.indexOf(currentKey)

  return index === -1 ? null : (keys[index + 1] ?? null)
}

/** The three kinds that still open one of onboarding's own forms. */
const onboardingFormKinds = ["education", "experience", "skills"]

/**
 * What a step's crumb navigates to and is labelled by in the DOM: the kind,
 * for the three sections onboarding has a dedicated form for, or the step's
 * own id otherwise (contact, and any section onboarding has no form for).
 *
 * A section is stood in with its `kind` as its `id` until the account holds a
 * row of its own (`readAccountSections`), and gets a real one the moment it
 * does — so a step's `id` only names the same core section before and after
 * that by coincidence. Its `kind` is what the onboarding forms actually key
 * on (`goToStep("education")`, `activeStep === "education"`), and does not
 * change underneath it. Keying on `id` instead would leave every core crumb
 * un-clickable to its own panel the moment the account's sections are
 * written for real, which an import always does.
 */
export function onboardingPanelKey(step: OnboardingStep): string {
  return step.kind && onboardingFormKinds.includes(step.kind)
    ? step.kind
    : step.id
}
