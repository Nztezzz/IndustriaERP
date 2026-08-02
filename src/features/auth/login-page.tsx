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
    <div className="flex min-h-svh items-center justify-center bg-[#0A0A0A] p-4">
      <Card className="w-full max-w-sm border-0 bg-[#1C1C1E] shadow-2xl shadow-orange-950/20">
        <CardHeader className="items-center text-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#F5820D] to-[#D96A00] shadow-lg shadow-orange-600/30">
            <Factory className="size-7 text-white" />
          </div>
          <CardTitle className="text-xl text-white">{APP_NAME}</CardTitle>
          <CardDescription className="text-[#A8A39D]">Sign in to your account to continue</CardDescription>
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
                    <FormLabel className="text-[#A8A39D]">Username</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="username"
                        autoFocus
                        placeholder="admin"
                        className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-[#F5820D]"
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
                    <FormLabel className="text-[#A8A39D]">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-[#F5820D]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="mt-2 bg-[#F5820D] text-white hover:bg-[#D96A00] focus-visible:ring-[#F5820D]"
                disabled={isSubmitting}
              >
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
