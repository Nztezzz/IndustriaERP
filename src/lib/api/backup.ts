import { invoke } from "@tauri-apps/api/core"
import { apiRequest } from "@/lib/api/client"
import type { BackupDto } from "@/lib/api/types"
import { getAuthToken } from "@/stores/auth-store"

export function fetchBackups() {
  return apiRequest<BackupDto[]>("/backup")
}

export function createBackup() {
  return apiRequest<BackupDto>("/backup", { method: "POST" })
}

/**
 * Restores the live database from a backup file and restarts the app.
 *
 * This is a Tauri command, not an HTTP call -- restoring requires closing
 * and reopening the live SQLite connection pool, which the Axum server
 * can't safely do to itself mid-request, and a full app restart is
 * unavoidable anyway. See `src-tauri/src/commands.rs::restore_backup`.
 *
 * The current JWT is passed along so the Rust side can independently
 * re-verify the caller is an Admin -- this action is destructive
 * (discards all data written since the backup), so it must not be
 * reachable with weaker checks than the HTTP endpoints that list backups.
 */
export async function restoreBackup(backupFilePath: string): Promise<void> {
  const token = getAuthToken()
  if (!token) {
    throw new Error("You must be signed in to restore a backup.")
  }
  await invoke("restore_backup", { token, backupFilePath })
}
