import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, UserRound, KeyRound, DatabaseBackup, HardDriveDownload, ShieldAlert, Info } from "lucide-react"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useAuthStore } from "@/stores/auth-store"
import { changePassword, changeUsername } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/client"
import { useBackups, useCreateBackup, useRestoreBackup } from "@/lib/api/hooks/use-backup"
import { parseResponseDateTime } from "@/lib/api/datetime"
import type { BackupDto } from "@/lib/api/types"
import { APP_NAME } from "@/lib/constants"

// === PROFILE TAB ===

const usernameSchema = z.object({
  newUsername: z.string().min(3, "Username must be at least 3 characters"),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type UsernameFormValues = z.infer<typeof usernameSchema>
type PasswordFormValues = z.infer<typeof passwordSchema>

function ProfileTab() {
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const [isPendingUsername, setIsPendingUsername] = useState(false)
  const [isPendingPassword, setIsPendingPassword] = useState(false)

  const usernameForm = useForm<UsernameFormValues>({
    resolver: zodResolver(usernameSchema),
    defaultValues: { newUsername: user?.username ?? "" },
  })

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  async function onUsernameSubmit(values: UsernameFormValues) {
    setIsPendingUsername(true)
    try {
      const response = await changeUsername(values)
      login(response.token, response.user)
      toast.success("Username changed successfully")
      usernameForm.reset({ newUsername: response.user.username })
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to change username")
    } finally {
      setIsPendingUsername(false)
    }
  }

  async function onPasswordSubmit(values: PasswordFormValues) {
    setIsPendingPassword(true)
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      toast.success("Password changed successfully")
      passwordForm.reset()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to change password")
    } finally {
      setIsPendingPassword(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-5" />
            Change Username
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...usernameForm}>
            <form onSubmit={usernameForm.handleSubmit(onUsernameSubmit)} className="flex flex-col gap-4">
              <FormField
                control={usernameForm.control}
                name="newUsername"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter new username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPendingUsername} className="w-fit">
                {isPendingUsername && <Loader2 className="animate-spin" />}
                Update Username
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="flex flex-col gap-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter current password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPendingPassword} className="w-fit">
                {isPendingPassword && <Loader2 className="animate-spin" />}
                Update Password
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

// === APPEARANCE TAB ===

function AppearanceTab() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Theme</Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Choose between light and dark mode, or follow your system preference.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// === BACKUP TAB ===

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function BackupTab() {
  const { data: backups, isLoading } = useBackups()
  const createBackup = useCreateBackup()
  const restoreBackup = useRestoreBackup()
  const [restoreTarget, setRestoreTarget] = useState<BackupDto | null>(null)

  async function confirmRestore(event: React.MouseEvent) {
    event.preventDefault()
    if (!restoreTarget) return
    try {
      await restoreBackup.mutateAsync(restoreTarget.filePath)
    } catch { /* error toast handled by hook */ }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium">Create a backup now</p>
            <p className="text-sm text-muted-foreground">
              Copies the live database to a timestamped backup file.
            </p>
          </div>
          <Button onClick={() => createBackup.mutate()} disabled={createBackup.isPending}>
            {createBackup.isPending ? <Loader2 className="animate-spin" /> : <DatabaseBackup />}
            Create backup
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="flex flex-col gap-3 px-4 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : !backups || backups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <DatabaseBackup className="size-8" />
              <p className="text-sm">No backups yet. Create one above.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="font-medium">
                      {parseResponseDateTime(backup.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatBytes(backup.fileSizeBytes)}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {backup.triggerType}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setRestoreTarget(backup)}>
                        <HardDriveDownload /> Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="text-destructive" />
              Restore this backup?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the current database with the backup from{" "}
              {restoreTarget && parseResponseDateTime(restoreTarget.createdAt).toLocaleString()}.
              All data entered after that point will be permanently lost. The app will restart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmRestore}
              disabled={restoreBackup.isPending}
            >
              {restoreBackup.isPending && <Loader2 className="animate-spin" />}
              Restore and restart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// === ABOUT TAB ===

function AboutTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="size-5" />
          About
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <span className="text-muted-foreground">Application</span>
          <span className="font-medium">{APP_NAME}</span>
          <span className="text-muted-foreground">Version</span>
          <span className="font-medium">0.1.0</span>
          <span className="text-muted-foreground">Company</span>
          <span className="font-medium">Preyansh Metal Industries LLP</span>
          <span className="text-muted-foreground">Location</span>
          <span className="font-medium">Tundel, Nadiad</span>
          <span className="text-muted-foreground">Stack</span>
          <span className="font-medium">Tauri + React + Rust + SQLite</span>
        </div>
      </CardContent>
    </Card>
  )
}

// === MAIN PAGE ===

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)

  return (
    <>
      <PageHeader
        title="Settings"
        description={`Signed in as ${user?.fullName ?? "\u2014"} (${user?.role ?? "\u2014"})`}
      />
      <div className="p-6">
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="backup">Backup & Restore</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="pt-4">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="appearance" className="pt-4">
            <AppearanceTab />
          </TabsContent>
          <TabsContent value="backup" className="pt-4">
            <BackupTab />
          </TabsContent>
          <TabsContent value="about" className="pt-4">
            <AboutTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
