"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "./ui/dialog"
import { useRouter } from "~/i18n/navigation"
import { signIn, signUp } from "~/lib/auth-client"
import { Form, FormField } from "./ui/form"
import { MyInput } from "./my-input"
import { z } from "zod"
import { appPath } from "~/lib/path"
import { useAppForm } from "~/components/use-app-form"

export function AuthModal({
  initialModal,
  label
}: {
  initialModal: Modal
  label: string
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="submit">{label}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <AuthSwitch initialModal={initialModal} />
      </DialogContent>
    </Dialog>
  )
}

type Modal = "sign-up" | "login"

function AuthSwitch({ initialModal }: { initialModal: Modal }) {
  const [modal, setModal] = useState<Modal>(initialModal)

  const handleSwitchAuth = () => {
    setModal((prev) => (prev === "sign-up" ? "login" : "sign-up"))
  }

  if (modal === "sign-up") {
    return <SignUpForm handleSwitchAuth={handleSwitchAuth} />
  }

  return <LoginForm handleSwitchAuth={handleSwitchAuth} />
}

/** better-auth codes we translate. Anything else falls back to its own text. */
const translatedAuthCodes = [
  "USER_ALREADY_EXISTS",
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_EMAIL",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG"
] as const

/**
 * better-auth writes its own error messages, and they are English whatever the
 * locale is. Sign-in is the first thing a Spanish reader touches, so the codes
 * that actually come up get translated; an unmapped code keeps the library's
 * English text rather than being flattened into a generic apology.
 */
function useAuthError() {
  const t = useTranslations("auth.errors")

  return (
    error: { code?: string; message?: string } | undefined,
    fallback: "signUpFailed" | "loginFailed"
  ) => {
    const code = translatedAuthCodes.find((known) => known === error?.code)

    if (code) return t(code)

    return error?.message ?? t(fallback)
  }
}

function SignUpForm({ handleSwitchAuth }: { handleSwitchAuth: () => void }) {
  const t = useTranslations("auth")
  const router = useRouter()
  const toMessage = useAuthError()

  /** The refine message is copy, so the schema can only exist inside render. */
  const schema = useMemo(
    () =>
      z
        .object({
          email: z.string().email().max(255),
          password: z.string().min(8).max(50),
          confirm: z.string().min(8).max(50)
        })
        .refine((data) => data.confirm === data.password, {
          message: t("validation.passwordsDoNotMatch"),
          path: ["confirm"]
        }),
    [t]
  )

  const form = useAppForm(schema, {
    defaultValues: { email: "", password: "", confirm: "" }
  })
  const [isPending, setIsPending] = useState(false)

  // better-auth signs the new user straight in, so there is no second call and
  // no window where an account exists but the browser has no session.
  const onSubmit = async ({ email, password }: z.infer<typeof schema>) => {
    setIsPending(true)

    const { error } = await signUp.email({ email, password, name: "" })

    setIsPending(false)

    if (error) {
      form.setError("email", { message: toMessage(error, "signUpFailed") })
      return
    }

    router.push(appPath.onboarding)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("signUp.title")}</DialogTitle>
        <DialogDescription>{t("signUp.description")}</DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 pt-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <MyInput field={field} label={t("fields.email")} />
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <MyInput
                field={field}
                type="password"
                label={t("fields.password")}
              />
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <MyInput
                field={field}
                type="password"
                label={t("fields.confirmPassword")}
              />
            )}
          />
          <DialogFooter className="pt-4">
            <Button onClick={handleSwitchAuth} type="button" variant="link">
              {t("signUp.switch")}
            </Button>

            <Button loading={isPending} type="submit">
              {isPending ? t("signUp.submitting") : t("signUp.submit")}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}

const loginFormSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(50)
})

type LoginFormValues = z.infer<typeof loginFormSchema>

function LoginForm({ handleSwitchAuth }: { handleSwitchAuth: () => void }) {
  const t = useTranslations("auth")
  const router = useRouter()
  const toMessage = useAuthError()

  const form = useAppForm(loginFormSchema, {
    defaultValues: { email: "", password: "" }
  })
  const [isPending, setIsPending] = useState(false)

  const onSubmit = async ({ email, password }: LoginFormValues) => {
    setIsPending(true)

    const { error } = await signIn.email({ email, password })

    setIsPending(false)

    if (error) {
      form.setError("email", { message: toMessage(error, "loginFailed") })
      return
    }

    router.push(appPath.newResume)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("login.title")}</DialogTitle>
        <DialogDescription>{t("login.description")}</DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 pt-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <MyInput field={field} label={t("fields.email")} />
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <MyInput
                field={field}
                type="password"
                label={t("fields.password")}
              />
            )}
          />
          <DialogFooter className="pt-4">
            <Button onClick={handleSwitchAuth} type="button" variant="link">
              {t("login.switch")}
            </Button>

            <Button loading={isPending} type="submit">
              {isPending ? t("login.submitting") : t("login.submit")}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
