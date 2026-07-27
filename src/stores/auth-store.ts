import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { AuthUserDto } from "@/lib/api/types"

/** Re-exported so existing call sites can keep importing `AuthUser` from
 * the store rather than reaching into `lib/api/types` -- but there is only
 * ONE definition of "what a logged-in user looks like" now, not two. */
export type AuthUser = AuthUserDto

interface AuthState {
  token: string | null
  user: AuthUser | null
  /** True once the persisted store has finished rehydrating from disk. */
  hasHydrated: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
  setHasHydrated: (value: boolean) => void
}

/**
 * Session state for the currently logged-in user.
 *
 * The JWT is kept in memory + persisted to localStorage (via Tauri's webview
 * storage) purely for session continuity across app restarts. The Rust
 * backend is still the source of truth for every authorization decision --
 * this store only drives client-side route gating and UI conditionals.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hasHydrated: false,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "preyansh-erp-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

export function getAuthToken(): string | null {
  return useAuthStore.getState().token
}
