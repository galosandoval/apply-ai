"use client"

import { useTranslations } from "next-intl"
import { useRef } from "react"
import {
  type Control,
  type FieldPath,
  type FieldValues,
  type PathValue,
  useFormContext,
  useWatch
} from "react-hook-form"
import { Checkbox } from "~/components/ui/checkbox"
import { MyInput } from "~/components/my-input"
import { FormField } from "~/components/ui/form"

/**
 * When an entry started, when it ended, and whether it has.
 *
 * One component for both steps because a job and a school ask the same three
 * questions and differ only in what the box beside the end date is called —
 * "I currently work here" against "I currently attend".
 *
 * The dates are typed rather than free text since #71: the column holds one of
 * `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, and the placeholder plus the hint under
 * the field is how the user is told which. A picker was the obvious
 * alternative and was rejected — `<input type="month">` can hold only month
 * precision, so a history recorded as `2017`, including one this app's own
 * migration left that way, would render as an empty box that the next save
 * would then blank.
 */
export function EntryDateFields<TFieldValues extends FieldValues>({
  control,
  startDate,
  endDate,
  current,
  currentLabel
}: {
  control: Control<TFieldValues>
  startDate: FieldPath<TFieldValues>
  endDate: FieldPath<TFieldValues>
  current: FieldPath<TFieldValues>
  /** What ticking the box claims — the one thing the two steps disagree on. */
  currentLabel: string
}) {
  const t = useTranslations("onboarding.dates")
  const { setValue } = useFormContext<TFieldValues>()
  const isCurrent = Boolean(useWatch({ control, name: current }))
  const endValue = useWatch({ control, name: endDate })

  /** What ticking the box cleared, so unticking can put it back. */
  const cleared = useRef("")

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 max-sm:flex-col">
        <FormField
          control={control}
          name={startDate}
          render={({ field }) => (
            <MyInput
              description={t("hint")}
              field={field}
              inputMode="numeric"
              label={t("startDate")}
              placeholder={t("placeholder")}
              required
            />
          )}
        />

        <FormField
          control={control}
          name={endDate}
          render={({ field }) => (
            <MyInput
              description={t("hint")}
              disabled={isCurrent}
              field={field}
              inputMode="numeric"
              label={t("endDate")}
              placeholder={t("placeholder")}
              required={!isCurrent}
            />
          )}
        />
      </div>

      <FormField
        control={control}
        name={current}
        render={({ field }) => (
          <Checkbox
            checked={Boolean(field.value)}
            id={field.name}
            label={currentLabel}
            onCheckedChange={(checked) => {
              /*
                  Ticking the box is also saying when the entry ended, which is
                  nowhere. Clearing the end date here is what keeps the pair in
                  a state the write schema accepts — it refuses a set flag
                  beside a date, because a row carrying both is a row two
                  readers disagree about. Unticking puts the date back, so a box
                  ticked by accident does not cost the user what they typed.
                */
              const write = (value: string) =>
                setValue(
                  endDate,
                  value as PathValue<TFieldValues, typeof endDate>,
                  { shouldValidate: true }
                )

              if (checked) {
                cleared.current = String(endValue ?? "")
                write("")
              } else if (cleared.current) {
                write(cleared.current)
                cleared.current = ""
              }

              field.onChange(checked)
            }}
          />
        )}
      />
    </div>
  )
}
