import { apiRequest } from "@/lib/api/client"

export interface PackingSlipLineItem {
  size: string
  strand: string
  meter: string
  grossWeight: string
  tareWeight: string
}

export interface PackingSlipDto {
  id: string
  partyName: string
  invoiceNo: string
  date: string
  tempoNo: string | null
  totalParcel: string | null
  lineItems: PackingSlipLineItem[]
  totalGross: number
  totalTare: number
  totalNet: number
  createdAt: string
}

export interface CreatePackingSlipInput {
  partyName: string
  invoiceNo: string
  date: string
  tempoNo?: string | null
  totalParcel?: string | null
  lineItems: PackingSlipLineItem[]
  totalGross: number
  totalTare: number
  totalNet: number
}

export function fetchPackingSlips() {
  return apiRequest<PackingSlipDto[]>("/packing-slips")
}

export function fetchPackingSlip(id: string) {
  return apiRequest<PackingSlipDto>(`/packing-slips/${id}`)
}

export function createPackingSlip(input: CreatePackingSlipInput) {
  return apiRequest<PackingSlipDto>("/packing-slips", {
    method: "POST",
    body: input,
  })
}
