import { apiRequest } from "@/lib/api/client"
import type { UnitDto } from "@/lib/api/types"

export interface UnitInput {
  name: string
  symbol: string
  conversionFactor: number
}

export function fetchUnits() {
  return apiRequest<UnitDto[]>("/units")
}

export function createUnit(input: UnitInput) {
  return apiRequest<UnitDto>("/units", { method: "POST", body: input })
}

export function updateUnit(id: string, input: UnitInput) {
  return apiRequest<UnitDto>(`/units/${id}`, { method: "PUT", body: input })
}

export function deleteUnit(id: string) {
  return apiRequest<void>(`/units/${id}`, { method: "DELETE" })
}
