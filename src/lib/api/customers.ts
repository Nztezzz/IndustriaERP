import { apiRequest } from "@/lib/api/client"
import type { CustomerDto } from "@/lib/api/types"

export interface CustomerInput {
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  gstNumber?: string | null
  isActive?: boolean
}

export function fetchCustomers(includeInactive = false) {
  return apiRequest<CustomerDto[]>("/customers", {
    query: { includeInactive },
  })
}

export function fetchCustomer(id: string) {
  return apiRequest<CustomerDto>(`/customers/${id}`)
}

export function createCustomer(input: CustomerInput) {
  return apiRequest<CustomerDto>("/customers", { method: "POST", body: input })
}

export function updateCustomer(id: string, input: CustomerInput) {
  return apiRequest<CustomerDto>(`/customers/${id}`, {
    method: "PUT",
    body: input,
  })
}
