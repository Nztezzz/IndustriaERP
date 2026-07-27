import { useEffect, useRef, useState } from "react"
import { Check, Copy, ShieldAlert } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { takeFirstRunCredentials, type FirstRunCredentials } from "@/lib/api/app"

const POLL_INTERVAL_MS = 400
/** ~8s of polling -- generous enough to cover a fresh-install migration run
 * finishing in the background without making a normal launch feel slow. */
const MAX_ATTEMPTS = 20

/**
 * Shows the auto-generated admin credentials exactly once, on the very
 * first launch after install.
 *
 * The backend writes a one-time JSON file during its own startup (after
 * running migrations and creating the admin user) and this polls for it
 * because that startup happens in a background Tauri task racing against
 * the webview's own load -- there is no guarantee the file exists yet on
 * our first check, so a single call risks silently skipping the modal on
 * a genuinely fresh install.
 *
 * `take_first_run_credentials` deletes the file as it reads it, so calling
 * it repeatedly is safe: every call after the real one just returns `null`.
 *
 * Mounted once at the app root so it works whether the user is currently
 * sitting on `/login` or already past it.
 */
export function FirstRunCredentialsDialog() {
  const [credentials, setCredentials] = useState<FirstRunCredentials | null>(
    null
  )
  const [acknowledged, setAcknowledged] = useState(false)
  const [copied, setCopied] = useState(false)
  const foundRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let attempts = 0

    const timer = window.setInterval(() => {
      if (cancelled || foundRef.current) return
      attempts += 1

      takeFirstRunCredentials()
        .then((result) => {
          if (cancelled) return
          if (result) {
            foundRef.current = true
            setCredentials(result)
            window.clearInterval(timer)
          } else if (attempts >= MAX_ATTEMPTS) {
            window.clearInterval(timer)
          }
        })
        .catch(() => {
          // Tauri bridge unavailable (e.g. plain-browser frontend dev) --
          // stop trying rather than spamming rejected promises.
          window.clearInterval(timer)
        })
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  function handleCopy() {
    if (!credentials) return
    navigator.clipboard
      .writeText(`Username: ${credentials.username}\nPassword: ${credentials.password}`)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        // Clipboard permissions can be denied by the host environment;
        // the credentials are still visible in the dialog either way.
      })
  }

  if (!credentials) return null

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldAlert className="size-5" />
          </div>
          <DialogTitle>Admin account created</DialogTitle>
          <DialogDescription>
            This is the only time these credentials will be shown. Save them
            somewhere safe -- the password can&apos;t be recovered later, only
            reset by an admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Username</span>
            <span className="font-medium">{credentials.username}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Password</span>
            <span className="font-medium">{credentials.password}</span>
          </div>
        </div>

        <Button variant="outline" onClick={handleCopy} className="w-full">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy to clipboard"}
        </Button>

        <div className="flex items-start gap-2 pt-2">
          <Checkbox
            id="ack-credentials"
            checked={acknowledged}
            onCheckedChange={(value) => setAcknowledged(value === true)}
          />
          <Label
            htmlFor="ack-credentials"
            className="text-sm font-normal text-muted-foreground"
          >
            I have saved these credentials somewhere safe.
          </Label>
        </div>

        <DialogFooter>
          <Button
            disabled={!acknowledged}
            onClick={() => setCredentials(null)}
            className="w-full"
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
