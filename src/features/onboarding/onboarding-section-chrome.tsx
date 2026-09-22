"use client"

import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { useErrorText } from "~/components/use-error-text"
import { useTypedValue } from "~/components/use-typed-value"
import { useRouter } from "~/i18n/navigation"
import { moveItem } from "~/lib/move-item"
import { appPath } from "~/lib/path"
import { nextOnboardingStep } from "~/features/onboarding/onboarding-steps"
import { useOnboardingStep } from "~/features/onboarding/use-onboarding-step"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

/**
 * What every derived section step wears above its own editor: a name the user
 * can change, and where it sits, and whether it stays.
 *
 * Rename, remove and reorder are the account's, not onboarding's — this calls
 * exactly the mutations the resume editor's own section panel calls
 * (`section.rename`, `section.remove`, `section.reorder`, all `onAccount`),
 * so a section renamed or reordered here is renamed or reordered the same way
 * it would be from the editor later. Nothing here decides what "rename" or
 * "reorder" mean; it only wires this step's own section into them.
 */
export function OnboardingSectionChrome({
  panelKey,
  sectionId,
  children
}: {
  /** What this step is keyed by — a core kind, or the section's own id. */
  panelKey: string
  sectionId: string
  children: React.ReactNode
}) {
  const t = useTranslations("resumePanel")
  const errorText = useErrorText()
  const router = useRouter()
  const { goToStep } = useOnboardingStep()
  const utils = api.useUtils()
  const { id: userId } = useUser()

  const { data: profile } = api.profile.read.useQuery(undefined, {
    enabled: !!userId
  })

  const sections = profile?.sections ?? []
  const index = sections.findIndex((row) => row.id === sectionId)
  const section = sections[index]

  const advance = () => {
    const next = profile && nextOnboardingStep(profile, panelKey)

    if (next) {
      goToStep(next)
    } else {
      router.push(appPath.newResume)
    }
  }

  const onError = (error: Parameters<typeof errorText>[0]) =>
    toast.error(errorText(error))

  const rename = api.section.rename.useMutation({
    onError,
    onSuccess: () => utils.profile.read.invalidate()
  })

  const remove = api.section.remove.useMutation({
    onError,
    onSuccess: () => {
      void utils.profile.read.invalidate()
      advance()
    }
  })

  const reorder = api.section.reorder.useMutation({
    onError,
    onSuccess: () => utils.profile.read.invalidate()
  })

  // Buffered locally and sent on blur — see `commitLabel` — so a rename is
  // not a mutation per keystroke.
  const typed = useTypedValue(section?.label ?? "", () => undefined)

  const commitLabel = () => {
    if (!section || typed.props.value === section.label) return

    rename.mutate({
      onAccount: true,
      sectionId: section.id,
      label: typed.props.value
    })
  }

  const move = (to: number) => {
    if (!section) return

    reorder.mutate({
      onAccount: true,
      sectionIds: moveItem(
        sections.map((row) => row.id),
        index,
        to
      )
    })
  }

  if (!section) return <>{children}</>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="onboarding-section-name">{t("sectionName")}</Label>
          <Input id="onboarding-section-name" onBlur={commitLabel} {...typed.props} />
        </div>

        <div className="flex gap-1">
          {index > 0 && (
            <Button
              onClick={() => move(index - 1)}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("moveUp")}
            </Button>
          )}

          {index < sections.length - 1 && (
            <Button
              onClick={() => move(index + 1)}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("moveDown")}
            </Button>
          )}

          <Button
            onClick={() => remove.mutate({ onAccount: true, sectionId: section.id })}
            size="sm"
            type="button"
            variant="destructive"
          >
            {t("remove")}
          </Button>
        </div>
      </div>

      {children}
    </div>
  )
}
