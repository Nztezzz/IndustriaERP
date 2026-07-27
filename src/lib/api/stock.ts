import { apiRequest } from "@/lib/api/client"
import type {
  PagedResult,
  StockBalanceDto,
  StockMovementDto,
} from "@/lib/api/types"
import type { StockMovementType } from "@/lib/constants"

export interface MovementsQuery {
  productId?: string
  movementType?: StockMovementType
  /** "yyyy-MM-ddTHH:mm:ss" -- use `toRequestDateTime` to build this. */
  from?: string
  to?: string
  page?: number
  pageSize?: number
  // Index signature so this satisfies apiRequest's generic query bag type.
  [key: string]: string | number | boolean | undefined | null
}

export interface InwardInput {
  productId: string
  quantity: number
  referenceNumber?: string | null
  remarks?: string | null
}

export interface OutwardInput {
  productId: string
  quantity: number
  referenceNumber?: string | null
  remarks?: string | null
}

export interface AdjustmentInput {
  productId: string
  /** Signed: positive corrects stock upward, negative corrects it downward. */
  delta: number
  remarks: string
}

export function fetchStockBalances() {
  return apiRequest<StockBalanceDto[]>("/stock/balances")
}

export function fetchStockMovements(query: MovementsQuery = {}) {
  return apiRequest<PagedResult<StockMovementDto>>("/stock/movements", {
    query,
  })
}

export function recordInward(input: InwardInput) {
  return apiRequest<StockMovementDto>("/stock/inward", {
    method: "POST",
    body: input,
  })
}

export function recordOutward(input: OutwardInput) {
  return apiRequest<StockMovementDto>("/stock/outward", {
    method: "POST",
    body: input,
  })
}

export function recordAdjustment(input: AdjustmentInput) {
  return apiRequest<StockMovementDto>("/stock/adjustment", {
    method: "POST",
    body: input,
  })
}
