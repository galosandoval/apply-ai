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
import { useRouter } from "next/router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "~/utils/api"
import { signIn } from "next-auth/react"
import { Form, FormField } from "./ui/form"
import { MyInput } from "./my-input"
import { z } from "zod"

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

export function AuthModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="submit" variant="outline">
          Get started
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <AuthSwitch />
      </DialogContent>
    </Dialog>
  )
}

type Modal = "sign-up" | "login"

function AuthSwitch() {
  const [modal, setModal] = useState<Modal>("sign-up")

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

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema)
  })

  const { mutate, isLoading } = api.user.create.useMutation({
    onSuccess: async (_, { password, email }) => {
      const response = await signIn("credentials", {
        email,
        password,
        redirect: false
      })

      if (response?.ok) {
        await router.push("/onboarding/contact")
      }
    },
    onError: (error) => {
      console.log(error)
      form.setError("email", {
        message: error.message
      })
    }
  })

  const onSubmit = (data: SignUpFormValues) => {
    console.log(data)
    mutate(data)
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

            <Button loading={isLoading} type="submit">
              {isLoading ? "Creating Account" : "Create Account"}
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

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema)
  })

  const { mutate, isLoading } = api.user.create.useMutation({
    onSuccess: async (_, { password, email }) => {
      const response = await signIn("credentials", {
        email,
        password,
        redirect: false
      })

      if (response?.ok) {
        await router.push("/dashboard")
      }
    },
    onError: (error) => {
      console.log(error)
      form.setError("email", {
        message: error.message
      })
    }
  })

  const onSubmit = async (data: LoginFormValues) => {
    const { email, password } = data
    const response = await signIn("credentials", {
      email,
      password,
      redirect: false
    })

    if (response?.ok) {
      await router.push("/dashboard")
    }
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

            <Button loading={isLoading} type="submit">
              {isLoading ? "Logging In" : "Log In"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
