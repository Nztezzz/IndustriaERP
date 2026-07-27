import { getAuthToken, useAuthStore } from "@/stores/auth-store"
import { API_BASE_URL } from "@/lib/api/config"

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  /** Skip attaching the Authorization header (login/health-check only). */
  skipAuth?: boolean
  signal?: AbortSignal
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(`${API_BASE_URL}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

/**
 * Thin typed fetch wrapper shared by every module's API bindings. All actual
 * business logic, validation, and RBAC enforcement lives in the Rust
 * backend -- this client only handles transport, auth header injection, and
 * turning non-2xx responses into a typed ApiError.
 */
export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {}
): Promise<TResponse> {
  const { method = "GET", body, query, skipAuth, signal } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (!skipAuth) {
    const token = getAuthToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch {
    throw new ApiError(
      "Could not reach the local server. Try restarting the app.",
      0,
      "NETWORK_ERROR"
    )
  }

  if (response.status === 401) {
    // Session expired or token invalid/rotated -- force back to login.
    useAuthStore.getState().logout()
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    let code: string | undefined
    try {
      const errorBody = (await response.json()) as {
        message?: string
        code?: string
      }
      message = errorBody.message ?? message
      code = errorBody.code
    } catch {
      // Response had no JSON body; fall back to the generic message.
    }
    throw new ApiError(message, response.status, code)
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return (await response.json()) as TResponse
}
