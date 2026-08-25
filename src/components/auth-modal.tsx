"use client"

import { useState } from "react"
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
import { useRouter } from "next/navigation"
import { signIn, signUp } from "~/lib/auth-client"
import { Form, FormField } from "./ui/form"
import { MyInput } from "./my-input"
import { z } from "zod"
import { appPath } from "~/lib/path"
import { useAppForm } from "~/components/use-app-form"

const signUpSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(8).max(50),
    confirm: z.string().min(8).max(50)
  })
  .refine((data) => data.confirm === data.password, {
    message: "Passwords don't match",
    path: ["confirm"]
  })

type SignUpFormValues = z.infer<typeof signUpSchema>

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

function SignUpForm({ handleSwitchAuth }: { handleSwitchAuth: () => void }) {
  const router = useRouter()

  const form = useAppForm(signUpSchema, {
    defaultValues: { email: "", password: "", confirm: "" }
  })
  const [isPending, setIsPending] = useState(false)

  // better-auth signs the new user straight in, so there is no second call and
  // no window where an account exists but the browser has no session.
  const onSubmit = async ({ email, password }: SignUpFormValues) => {
    setIsPending(true)

    const { error } = await signUp.email({ email, password, name: "" })

    setIsPending(false)

    if (error) {
      form.setError("email", { message: error.message ?? "Sign up failed" })
      return
    }

    router.push(appPath.onboarding)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Sign Up</DialogTitle>
        <DialogDescription>
          Creating an account means we’ll save your work so you can return to it
          later.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 pt-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => <MyInput field={field} label="Email" />}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <MyInput field={field} type="password" label="Password" />
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <MyInput field={field} type="password" label="Confirm Password" />
            )}
          />
          <DialogFooter className="pt-4">
            <Button onClick={handleSwitchAuth} type="button" variant="link">
              Log In
            </Button>

            <Button loading={isPending} type="submit">
              {isPending ? "Creating Account" : "Create Account"}
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
  const router = useRouter()

  const form = useAppForm(loginFormSchema, {
    defaultValues: { email: "", password: "" }
  })
  const [isPending, setIsPending] = useState(false)

  const onSubmit = async ({ email, password }: LoginFormValues) => {
    setIsPending(true)

    const { error } = await signIn.email({ email, password })

    setIsPending(false)

    if (error) {
      form.setError("email", {
        message: error.message ?? "Those details didn't match an account"
      })
      return
    }

    router.push(appPath.dashboard)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Log In</DialogTitle>
        <DialogDescription>
          Log in to access your saved resumes and create new ones.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 pt-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => <MyInput field={field} label="Email" />}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <MyInput field={field} type="password" label="Password" />
            )}
          />
          <DialogFooter className="pt-4">
            <Button onClick={handleSwitchAuth} type="button" variant="link">
              Sign Up
            </Button>

            <Button loading={isPending} type="submit">
              {isPending ? "Logging In" : "Log In"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}