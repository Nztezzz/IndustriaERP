/**
 * Domain types mirroring the JSON shapes actually returned by the Rust API
 * (see crates/erp-server/src/routes/*.rs). Field names use camelCase here --
 * the backend's DTO structs explicitly `#[serde(rename = "camelCase")]`
 * each field, so the frontend never deals with snake_case.
 *
 * Timestamps: fields typed as `IsoTimestamp` are backend
 * `NaiveDateTime::to_string()` output, formatted "YYYY-MM-DD HH:MM:SS"
 * (space separator, no timezone) -- possibly with up to 9 fractional
 * seconds digits appended (".fffffffff") when the value carries real
 * sub-second precision. Always parse these via `parseResponseDateTime` in
 * `./datetime.ts` rather than a hand-rolled regex. This is NOT the same
 * format the backend expects back on requests -- see `toRequestDateTime`
 * for the format request bodies (e.g. dispatchDate) must use instead.
 */
import type {
  DispatchStatus,
  ReelEventType,
  ReelStatus,
  Role,
  StockMovementType,
} from "@/lib/constants"

/** Backend `NaiveDateTime` rendered via `.to_string()`: "YYYY-MM-DD HH:MM:SS". */
export type IsoTimestamp = string

export interface AuthUserDto {
  id: string
  username: string
  fullName: string
  role: Role
}

export interface LoginResponseDto {
  token: string
  user: AuthUserDto
}

export interface UnitDto {
  id: string
  name: string
  symbol: string
  /** Multiplier to convert 1 of this unit into the product's base unit. */
  conversionFactor: number
}

export interface ProductDto {
  id: string
  sku: string
  name: string
  description: string | null
  baseUnitId: string
  /** Only populated by the list endpoint (joined); null from other paths. */
  baseUnitSymbol: string | null
  specifications: Record<string, string> | null
  reorderLevel: number
  isActive: boolean
}

export interface CustomerDto {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  gstNumber: string | null
  isActive: boolean
}

export interface StockBalanceDto {
  productId: string
  productName: string
  productSku: string
  unitSymbol: string
  quantityOnHand: number
  reorderLevel: number
  isLowStock: boolean
  updatedAt: IsoTimestamp
}

export interface StockMovementDto {
  id: string
  productId: string
  movementType: StockMovementType
  quantity: number
  adjustmentDelta: number | null
  dispatchId: string | null
  referenceNumber: string | null
  remarks: string | null
  performedBy: string
  createdAt: IsoTimestamp
}

export interface DispatchItemDto {
  id: string
  productId: string
  quantity: number
  weightKg: number | null
}

/** Full detail shape returned by `GET /dispatches/{id}` and on create. */
export interface DispatchDto {
  id: string
  invoiceNumber: string
  customerId: string
  customerName: string
  vehicleNumber: string | null
  driverName: string | null
  driverPhone: string | null
  dispatchDate: IsoTimestamp
  status: DispatchStatus
  totalWeightKg: number | null
  remarks: string | null
  items: DispatchItemDto[]
  reelNumbers: string[]
  createdAt: IsoTimestamp
}

/** Lightweight row shape returned by `GET /dispatches` (list view). */
export interface DispatchListItemDto {
  id: string
  invoiceNumber: string
  customerId: string
  dispatchDate: IsoTimestamp
  status: DispatchStatus
  totalWeightKg: number | null
}

export interface ReelDto {
  id: string
  reelNumber: string
  productId: string
  status: ReelStatus
  currentCustomerId: string | null
  weightKg: number | null
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface ReelMovementDto {
  id: string
  eventType: ReelEventType
  dispatchId: string | null
  customerId: string | null
  remarks: string | null
  performedBy: string
  createdAt: IsoTimestamp
}

/**
 * Shape returned by `GET /customers/{id}/reel-history` -- NOT the same as
 * `ReelMovementDto` above (that's `GET /reels/{reelNumber}/history`'s
 * shape). Both back onto the same `reel_movement` entity, but the two
 * route handlers project different subsets of it: this one includes
 * `reelId` (useful here since a customer's history spans many different
 * reels) and omits `customerId`/`performedBy` (redundant/unused for this
 * view). Keep this distinct rather than merging with `ReelMovementDto` --
 * they really are different response contracts, matching different Rust
 * structs (both happen to be named `ReelMovementDto` server-side, which is
 * an internal implementation detail, not a shared wire type).
 */
export interface CustomerReelMovementDto {
  id: string
  reelId: string
  reelNumber: string
  productName: string
  eventType: ReelEventType
  dispatchId: string | null
  remarks: string | null
  createdAt: IsoTimestamp
}

export interface AuditLogDto {
  id: string
  entityType: string
  entityId: string
  action: string
  performedBy: string
  /** Resolved username for `performedBy` (see routes/audit_log.rs). */
  performedByUsername: string
  changesSummary: string | null
  createdAt: IsoTimestamp
}

export interface BackupDto {
  id: string
  filePath: string
  fileSizeBytes: number
  triggerType: "manual" | "scheduled"
  createdAt: IsoTimestamp
}

export interface DashboardSummaryDto {
  totalProducts: number
  lowStockProductCount: number
  todayInwardCount: number
  todayOutwardCount: number
  todayDispatchCount: number
  pendingReelCount: number
}

export interface ActivityEntryDto {
  kind: string
  description: string
  timestamp: IsoTimestamp
}

export interface ProductSearchHit {
  id: string
  sku: string
  name: string
}

export interface CustomerSearchHit {
  id: string
  name: string
  phone: string | null
}

export interface ReelSearchHit {
  id: string
  reelNumber: string
  status: ReelStatus
}

export interface DispatchSearchHit {
  id: string
  invoiceNumber: string
}

export interface SearchResultsDto {
  products: ProductSearchHit[]
  customers: CustomerSearchHit[]
  reels: ReelSearchHit[]
  dispatches: DispatchSearchHit[]
}

export interface ProductMovementSummaryDto {
  productId: string
  productName: string
  productSku: string
  totalInward: number
  totalOutward: number
  totalAdjustmentDelta: number
}

export interface CustomerDispatchSummaryDto {
  customerId: string
  customerName: string
  dispatchCount: number
  totalWeightKg: number
}

export interface DailyActivitySummaryDto {
  /** "YYYY-MM-DD" */
  date: string
  inwardCount: number
  outwardCount: number
  dispatchCount: number
}

export interface PendingReelReportRowDto {
  reelNumber: string
  productName: string
  customerName: string | null
  status: ReelStatus
  since: IsoTimestamp
}

export interface DispatchReportRowDto {
  invoiceNumber: string
  customerName: string
  dispatchDate: IsoTimestamp
  status: DispatchStatus
  totalWeightKg: number | null
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
