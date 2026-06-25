// Typed client for the ToDoToday backend API.
//
// NOTE: this is a contract stub only — it is NOT wired into the app or the
// Zustand store yet. The cross-device sync follow-up will call these from the
// store (pull on login, debounced push on change). Until then the app behaves
// exactly as before (local-only). The API base URL comes from VITE_API_URL.

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787'

export interface AuthSession {
  user: { id: string; email: string }
  accessToken: string
  refreshToken: string
}

export interface PlannerSnapshot {
  data: unknown
  version: number
}

export type PutPlannerResult =
  | { ok: true; snapshot: PlannerSnapshot }
  | { ok: false; conflict: PlannerSnapshot }

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOpts {
  method?: string
  body?: unknown
  accessToken?: string
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.accessToken ? { Authorization: `Bearer ${opts.accessToken}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (payload as { error?: string }).error ?? res.statusText)
  return payload as T
}

export function register(email: string, password: string): Promise<AuthSession> {
  return request('/auth/register', { method: 'POST', body: { email, password } })
}

export function login(email: string, password: string): Promise<AuthSession> {
  return request('/auth/login', { method: 'POST', body: { email, password } })
}

export function refresh(refreshToken: string): Promise<AuthSession> {
  return request('/auth/refresh', { method: 'POST', body: { refreshToken } })
}

export function logout(refreshToken: string): Promise<void> {
  return request('/auth/logout', { method: 'POST', body: { refreshToken } })
}

export function getMe(accessToken: string): Promise<{ id: string; email: string }> {
  return request('/me', { accessToken })
}

export function getPlanner(accessToken: string): Promise<PlannerSnapshot> {
  return request('/planner', { accessToken })
}

export async function putPlanner(
  accessToken: string,
  data: unknown,
  version: number,
): Promise<PutPlannerResult> {
  try {
    const snapshot = await request<PlannerSnapshot>('/planner', {
      method: 'PUT',
      body: { data, version },
      accessToken,
    })
    return { ok: true, snapshot }
  } catch (err) {
    // A 409 carries the current server state so the caller can reconcile.
    if (err instanceof ApiError && err.status === 409) {
      const res = await fetch(`${API_URL}/planner`, { headers: { Authorization: `Bearer ${accessToken}` } })
      const conflict = (await res.json()) as PlannerSnapshot
      return { ok: false, conflict }
    }
    throw err
  }
}
