/**
 * Shared enum-like constants for roles and stock/dispatch statuses.
 * Mirrors the `role`, `movement_type`, and `dispatch_status` values used in the
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

/**
 * `return` is its own type, not a flavour of `inward`. Both add to the
 * on-hand balance, but inward means "produced/received" and must stay
 * fixed once recorded -- folding returns into it made a 20-unit inward
 * read as 23 after a 3-unit return.
 */
export const STOCK_MOVEMENT_TYPES = [
  "inward",
  "outward",
  "return",
  "adjustment",
] as const
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

/** Operator-facing label for each movement type. */
export const MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  inward: "Inward",
  // Stock only ever leaves via a dispatch, so the operator-facing word is
  // "Dispatch" even though the ledger stores it as `outward`.
  outward: "Dispatch",
  return: "Return",
  adjustment: "Adjustment",
}

export const DISPATCH_STATUSES = [
  "pending",
  "delivered",
  "partially_returned",
  "returned",
  "cancelled",
] as const
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number]

/**
 * Display label per dispatch status. Needed because the raw values are
 * snake_case -- a plain `capitalize` would print "Partially_returned" in
 * exports and PDFs.
 */
export const DISPATCH_STATUS_LABEL: Record<DispatchStatus, string> = {
  pending: "Pending",
  delivered: "Delivered",
  partially_returned: "Partially returned",
  returned: "Returned",
  cancelled: "Cancelled",
}

export const APP_NAME = "Preyansh ERP"
