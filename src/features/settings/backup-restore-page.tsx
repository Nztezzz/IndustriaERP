import { useState } from "react"
import { DatabaseBackup, HardDriveDownload, Loader2, ShieldAlert } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { RequireRole } from "@/components/layout/require-role"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { useBackups, useCreateBackup, useRestoreBackup } from "@/lib/api/hooks/use-backup"
import { parseResponseDateTime } from "@/lib/api/datetime"
import type { BackupDto } from "@/lib/api/types"

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

export function BackupRestorePage() {
  return (
    <>
      <PageHeader
        title="Backup & Restore"
        description="Manual and scheduled backups of the local database (Admin only)."
      />
      <RequireRole minRole="admin">
        <BackupRestoreContent />
      </RequireRole>
    </>
  )
}

/**
 * Split into its own inner component (same pattern as task 18's inward
 * entry page) so its data hooks only run once the RequireRole check
 * above has actually passed.
 */
function BackupRestoreContent() {
  const { data: backups, isLoading } = useBackups()
  const createBackup = useCreateBackup()
  const restoreBackup = useRestoreBackup()
  const [restoreTarget, setRestoreTarget] = useState<BackupDto | null>(null)

  // Restoring copies the backup over the live database and then restarts
  // the whole app (see restore_backup in src-tauri/src/commands.rs) --
  // there's nothing to show AFTER a successful restore, the app just
  // reloads from scratch. This confirmation dialog IS the safety net,
  // there is no undo once confirmed.
  async function confirmRestore(event: React.MouseEvent) {
    event.preventDefault()
    if (!restoreTarget) return
    try {
      await restoreBackup.mutateAsync(restoreTarget.filePath)
    } catch {
      // Error toast already shown by useRestoreBackup's onError; keep the
      // dialog open (matches confirmDelete's pattern from unit-list-page.tsx)
      // so the user can see what failed rather than it just vanishing.
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <Card>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium">Create a backup now</p>
            <p className="text-sm text-muted-foreground">
              Copies the live database to a timestamped file in the app&apos;s
              backup folder.
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
                  <TableHead>File</TableHead>
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
                    <TableCell className="max-w-xs truncate text-muted-foreground" title={backup.filePath}>
                      {backup.filePath}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatBytes(backup.fileSizeBytes)}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {backup.triggerType}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRestoreTarget(backup)}
                      >
                        <HardDriveDownload />
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="text-destructive" />
              Restore this backup?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the ENTIRE current database with the backup from{" "}
              {restoreTarget && parseResponseDateTime(restoreTarget.createdAt).toLocaleString()}.
              Any data entered after that point (inventory movements, dispatches,
              reel updates, everything) will be permanently lost. The app will
              restart immediately after restoring. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
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
