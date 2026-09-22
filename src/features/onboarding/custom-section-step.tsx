"use client"

import { useTranslations } from "next-intl"
import { Button } from "~/components/ui/button"
import { useRouter } from "~/i18n/navigation"
import { appPath } from "~/lib/path"
import {
  formatResumeFieldPath,
  parseResumeFieldPath
} from "~/lib/resume-field-path"
import {
  type AnySectionContent,
  replaceSectionContentString,
  sectionContentFields
} from "~/lib/section-content"
import { OnboardingSectionChrome } from "~/features/onboarding/onboarding-section-chrome"
import { nextOnboardingStep } from "~/features/onboarding/onboarding-steps"
import { useOnboardingStep } from "~/features/onboarding/use-onboarding-step"
import {
  contentList,
  type PanelField,
  type PanelModel
} from "~/features/resume/resume-panel-model"
import { ResumePanel } from "~/features/resume/resume-panel"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

/**
 * The step for a section found by import that onboarding has no form of its
 * own for — a custom section carries whatever content the shape registry
 * describes, and that registry is what already generates the resume editor's
 * panel for it. Rendering anything else here would be a second editor for the
 * same content, reached by a different route, agreeing with the first only by
 * coincidence.
 *
 * So this builds exactly the `PanelModel` the editor's own `sectionPanel`
 * would for a custom section — its content fields and its collection, via the
 * same `contentList` — and hands it to the same `ResumePanel`. The section's
 * name, position and whether it stays are `OnboardingSectionChrome`'s, not
 * this component's: this is the content, wrapped by the chrome every derived
 * section step wears.
 */
export function CustomSectionStep({ sectionId }: { sectionId: string }) {
  const t = useTranslations("onboarding.section")
  const panelT = useTranslations("resumePanel")
  const contentT = useTranslations("sectionContent")
  const router = useRouter()
  const { goToStep } = useOnboardingStep()
  const utils = api.useUtils()
  const { id: userId } = useUser()

  const { data: profile } = api.profile.read.useQuery(undefined, {
    enabled: !!userId
  })

  const section = profile?.sections.find((row) => row.id === sectionId)

  const patchContent = (content: AnySectionContent) => {
    utils.profile.read.setData(undefined, (old) =>
      old
        ? {
            ...old,
            sections: old.sections.map((row) =>
              row.id === sectionId ? { ...row, content } : row
            )
          }
        : old
    )
  }

  const setContent = api.section.setContent.useMutation({
    onSuccess: () => utils.profile.read.invalidate()
  })

  const writeContent = (id: string, content: AnySectionContent) => {
    patchContent(content)
    setContent.mutate({ onAccount: true, sectionId: id, content })
  }

  // Every keystroke updates the cache, the same way onboarding's contact step
  // already does — so the field shows what was typed without a round trip,
  // and `onCommit` below always reads what is actually about to be sent.
  const onChange = (path: string, value: string) => {
    if (!section) return

    const target = parseResumeFieldPath(path)

    if (target?.section !== "section" || target.kind !== "content") return

    const next = replaceSectionContentString(
      target.content,
      section.content,
      value
    )

    if (next) patchContent(next)
  }

  const onCommit = () => {
    const latest = utils.profile.read
      .getData()
      ?.sections.find((row) => row.id === sectionId)

    if (!latest) return

    setContent.mutate({
      onAccount: true,
      sectionId,
      content: latest.content as AnySectionContent
    })
  }

  if (!section || !profile) return null

  const fields: PanelField[] = sectionContentFields(
    section.componentType,
    section.content
  ).map((field) => ({
    path: formatResumeFieldPath({
      section: "section",
      kind: "content",
      row: section.id,
      content: field.target
    }),
    label: contentT(field.labelKey),
    value: field.value,
    input: field.input
  }))

  const panel: PanelModel = {
    title: "",
    fields,
    lists: contentList(section, { setContent: writeContent }, panelT, contentT),
    actions: []
  }

  const next = nextOnboardingStep(profile, sectionId)

  return (
    <OnboardingSectionChrome panelKey={sectionId} sectionId={sectionId}>
      <div className="flex flex-col gap-4">
        <ResumePanel onChange={onChange} onCommit={onCommit} panel={panel} />

        <div className="flex justify-end">
          <Button
            onClick={() =>
              next ? goToStep(next) : router.push(appPath.newResume)
            }
            type="button"
          >
            {t("next")}
          </Button>
        </div>
      </div>
    </OnboardingSectionChrome>
  )
}
