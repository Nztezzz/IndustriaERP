import { apiRequest } from "@/lib/api/client"
import type {
  DispatchDto,
  DispatchListItemDto,
  PagedResult,
} from "@/lib/api/types"

export interface DispatchListQuery {
  customerId?: string
  /** "yyyy-MM-ddTHH:mm:ss" -- use `toRequestDateTime` to build this. */
  from?: string
  to?: string
  page?: number
  pageSize?: number
  // Index signature so this satisfies apiRequest's generic query bag type.
  [key: string]: string | number | boolean | undefined | null
}

export interface DispatchItemInput {
  productId: string
  quantity: number
  weightKg?: number | null
}

export interface CreateDispatchInput {
  invoiceNumber: string
  customerId: string
  vehicleNumber?: string | null
  driverName?: string | null
  driverPhone?: string | null
  /** "yyyy-MM-ddTHH:mm:ss" -- use `toRequestDateTime` to build this. */
  dispatchDate: string
  remarks?: string | null
  items?: DispatchItemInput[]
  reelNumbers?: string[]
}

export function fetchDispatches(query: DispatchListQuery = {}) {
  return apiRequest<PagedResult<DispatchListItemDto>>("/dispatches", {
    query,
  })
}

export function fetchDispatch(id: string) {
  return apiRequest<DispatchDto>(`/dispatches/${id}`)
}

export function createDispatch(input: CreateDispatchInput) {
  return apiRequest<DispatchDto>("/dispatches", {
    method: "POST",
    body: input,
  })
}
