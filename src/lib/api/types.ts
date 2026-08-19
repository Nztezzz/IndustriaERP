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

export interface DispatchSearchHit {
  id: string
  invoiceNumber: string
}

export interface SearchResultsDto {
  products: ProductSearchHit[]
  customers: CustomerSearchHit[]
  dispatches: DispatchSearchHit[]
}

export interface ProductMovementSummaryDto {
  productId: string
  productName: string
  productSku: string
  totalInward: number
  /** Shown in the UI as "Dispatch" -- see MOVEMENT_TYPE_LABEL. */
  totalOutward: number
  /** Returns are tracked separately so `totalInward` never moves. */
  totalReturn: number
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
  returnCount: number
  dispatchCount: number
}

export interface DispatchReportRowDto {
  invoiceNumber: string
  customerName: string
  dispatchDate: IsoTimestamp
  status: DispatchStatus
  totalWeightKg: number | null
}

/**
 * Row-level ledger entry: one stock movement with its date and resolved
 * customer/party name, for reports that need individual entries rather
 * than aggregated totals.
 */
export interface LedgerEntryDto {
  id: string
  date: IsoTimestamp
  customerName: string | null
  productId: string
  productName: string
  productSku: string
  movementType: StockMovementType
  quantity: number
  referenceNumber: string | null
  remarks: string | null
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
