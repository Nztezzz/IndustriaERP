import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Factory } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useAuthStore } from "@/stores/auth-store"
import { APP_NAME } from "@/lib/constants"
import { login as loginRequest } from "@/lib/api/auth"

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const token = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Landing on /login with an active session (e.g. a stale bookmark, or the
  // user hitting back) should bounce straight past the form rather than
  // asking them to sign in again.
  useEffect(() => {
    if (hasHydrated && token) {
      navigate({ to: "/dashboard", replace: true })
    }
  }, [hasHydrated, token, navigate])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  })

  if (!hasHydrated || token) {
    return null
  }

  async function onSubmit(values: LoginFormValues) {
    setIsSubmitting(true)
    try {
      const { token, user } = await loginRequest(values)
      login(token, user)
      navigate({ to: "/dashboard" })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to sign in"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Factory className="size-5" />
          </div>
          <CardTitle>{APP_NAME}</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="username"
                        autoFocus
                        placeholder="admin"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="mt-2" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                Sign in
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
