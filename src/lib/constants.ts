/**
 * Shared enum-like constants for roles and reel/stock statuses.
 * Mirrors the `role`, `movement_type`, and `reel_status` values used in the
 * SQLite schema so the frontend and backend never drift out of sync.
 */

export const ROLES = ["admin", "operator", "viewer"] as const
export type Role = (typeof ROLES)[number]

/** Ordered from most to least privileged, used for `hasMinRole` checks. */
export const ROLE_RANK: Record<Role, number> = {
  admin: 3,
  operator: 2,
  viewer: 1,
}

export function hasMinRole(role: Role | undefined, minRole: Role): boolean {
  if (!role) return false
  return ROLE_RANK[role] >= ROLE_RANK[minRole]
}

export const STOCK_MOVEMENT_TYPES = ["inward", "outward", "adjustment"] as const
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

export const REEL_STATUSES = [
  "in_stock",
  "dispatched",
  "returned",
  "lost",
  "damaged",
] as const
export type ReelStatus = (typeof REEL_STATUSES)[number]

export const REEL_EVENT_TYPES = [
  "created",
  "dispatched",
  "returned",
  "lost",
  "damaged",
] as const
export type ReelEventType = (typeof REEL_EVENT_TYPES)[number]

export const DISPATCH_STATUSES = ["pending", "delivered", "cancelled"] as const
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number]

export const APP_NAME = "Preyansh ERP"
