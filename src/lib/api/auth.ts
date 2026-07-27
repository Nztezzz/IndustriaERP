import { apiRequest } from "@/lib/api/client"
import type { LoginResponseDto } from "@/lib/api/types"

export interface LoginPayload {
  username: string
  password: string
}

export async function login(
  payload: LoginPayload
): Promise<LoginResponseDto> {
  return apiRequest<LoginResponseDto>("/auth/login", {
    method: "POST",
    body: payload,
    skipAuth: true,
  })
}

export async function fetchCurrentUser() {
  return apiRequest<LoginResponseDto["user"]>("/auth/me")
}
