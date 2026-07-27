import { invoke } from "@tauri-apps/api/core"

export interface FirstRunCredentials {
  username: string
  password: string
}

/**
 * Reads and immediately deletes the one-time admin credentials file
 * written on first launch. Returns `null` on every call after the first --
 * call this once on app startup and show the result in a modal if present.
 */
export async function takeFirstRunCredentials(): Promise<FirstRunCredentials | null> {
  return invoke<FirstRunCredentials | null>("take_first_run_credentials")
}
