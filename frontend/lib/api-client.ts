/**
 * Single point of contact with the backend API.
 *
 * No component should call `fetch` directly against the API — everything
 * routes through here so auth headers, base URL, and error handling stay
 * in one place, and role-based portals can share it without duplication.
 */
import { getMockResponse, MOCK_MODE } from "./mock-router";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface RequestOptions extends RequestInit {
  token?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, method = "GET", body } = options;

  // NEXT_PUBLIC_MOCK_MODE=true short-circuits every call here with a
  // fixture response instead of a real fetch — see lib/mock-router.ts
  // and lib/mock-data.ts. Lets the whole frontend be browsed without a
  // backend running at all.
  if (MOCK_MODE) {
    const mocked = await getMockResponse<T>(path, method, body);
    if (mocked !== undefined) return mocked;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    body,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errBody.detail ?? response.statusText);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

/**
 * Same as apiClient, but automatically attaches the stored access token.
 * Use this from any authenticated page/component instead of passing
 * `{ token }` manually every time.
 */
const ACCESS_TOKEN_KEY = "visa_crm_access_token";

function authToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? localStorage.getItem(ACCESS_TOKEN_KEY) ?? undefined;
}

export const authedApiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiClient.get<T>(path, { ...options, token: authToken() }),
  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    apiClient.post<T>(path, body, { ...options, token: authToken() }),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    apiClient.patch<T>(path, body, { ...options, token: authToken() }),
  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    apiClient.put<T>(path, body, { ...options, token: authToken() }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiClient.delete<T>(path, { ...options, token: authToken() }),
};
