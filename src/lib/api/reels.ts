import { apiRequest } from "@/lib/api/client"
import type { PagedResult, ReelDto, ReelMovementDto } from "@/lib/api/types"
import type { ReelStatus } from "@/lib/constants"

export interface ReelListQuery {
  status?: ReelStatus
  customerId?: string
  productId?: string
  page?: number
  pageSize?: number
  // Index signature so this satisfies apiRequest's generic query bag type.
  [key: string]: string | number | boolean | undefined | null
}

export interface RegisterReelInput {
  reelNumber: string
  productId: string
  weightKg?: number | null
}

export function fetchReels(query: ReelListQuery = {}) {
  return apiRequest<PagedResult<ReelDto>>("/reels", { query })
}

export function fetchReel(reelNumber: string) {
  return apiRequest<ReelDto>(`/reels/${encodeURIComponent(reelNumber)}`)
}

export function fetchReelHistory(reelNumber: string) {
  return apiRequest<ReelMovementDto[]>(
    `/reels/${encodeURIComponent(reelNumber)}/history`
  )
}

export function registerReel(input: RegisterReelInput) {
  return apiRequest<ReelDto>("/reels", { method: "POST", body: input })
}

export function returnReel(reelNumber: string, remarks?: string | null) {
  return apiRequest<ReelDto>(
    `/reels/${encodeURIComponent(reelNumber)}/return`,
    { method: "POST", body: { remarks } }
  )
}

export function markReelLost(reelNumber: string, remarks: string) {
  return apiRequest<ReelDto>(
    `/reels/${encodeURIComponent(reelNumber)}/mark-lost`,
    { method: "POST", body: { remarks } }
  )
}

export function markReelDamaged(reelNumber: string, remarks: string) {
  return apiRequest<ReelDto>(
    `/reels/${encodeURIComponent(reelNumber)}/mark-damaged`,
    { method: "POST", body: { remarks } }
  )
}
