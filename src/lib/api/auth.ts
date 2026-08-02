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

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export async function changePassword(payload: ChangePasswordPayload) {
  return apiRequest<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: payload,
  })
}

export interface ChangeUsernamePayload {
  newUsername: string
}

export async function changeUsername(payload: ChangeUsernamePayload) {
  return apiRequest<LoginResponseDto>("/auth/change-username", {
    method: "POST",
    body: payload,
  })
}
