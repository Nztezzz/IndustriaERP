import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as backupApi from "@/lib/api/backup"
import { queryKeys } from "@/lib/api/query-keys"
import { ApiError } from "@/lib/api/client"

export function useBackups() {
  return useQuery({
    queryKey: queryKeys.backup.all(),
    queryFn: backupApi.fetchBackups,
  })
}

export function useCreateBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: backupApi.createBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backup.all() })
      toast.success("Backup created")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to create backup")
    },
  })
}

/**
 * Restoring replaces the live database and restarts the whole app (see
 * `restoreBackup` in `lib/api/backup.ts`), so there's no query cache left
 * to invalidate afterward -- the app reloads from scratch. `onSuccess`
 * here only covers the brief window before the restart actually happens.
 */
export function useRestoreBackup() {
  return useMutation({
    mutationFn: backupApi.restoreBackup,
    onSuccess: () => {
      toast.success("Backup restored. Restarting...")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to restore backup")
    },
  })
}
