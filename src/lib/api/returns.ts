import { apiRequest } from "@/lib/api/client"

export interface ReturnableItemDto {
  productId: string
  dispatchedQty: number
  alreadyReturnedQty: number
  returnableQty: number
}

export interface ReturnItemInput {
  productId: string
  quantity: number
}

export interface CreateReturnInput {
  dispatchId: string
  items: ReturnItemInput[]
  remarks?: string | null
}

export interface CreateReturnResponse {
  dispatchId: string
  itemsReturned: number
}

export function fetchReturnableItems(dispatchId: string) {
  return apiRequest<ReturnableItemDto[]>(
    `/dispatches/${dispatchId}/returnable-items`
  )
}

export function createReturn(input: CreateReturnInput) {
  return apiRequest<CreateReturnResponse>("/returns", {
    method: "POST",
    body: input,
  })
}
