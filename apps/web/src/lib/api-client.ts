/**
 * api-client.ts
 *
 * HTTP client for the AI SuperApp backend.
 * Handles JWT access tokens + refresh token rotation automatically.
 */

const GATEWAY = import.meta.env['VITE_GATEWAY_URL'] ?? 'http://localhost:3000'

// ── Token management ──────────────────────────────────────────────────────────

const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

export function getToken(): string | null { return localStorage.getItem(ACCESS_KEY) }
export function setToken(t: string): void { localStorage.setItem(ACCESS_KEY, t) }
export function clearToken(): void { localStorage.removeItem(ACCESS_KEY) }

export function getRefreshToken(): string | null { return localStorage.getItem(REFRESH_KEY) }
export function setRefreshToken(t: string): void { localStorage.setItem(REFRESH_KEY, t) }
export function clearRefreshToken(): void { localStorage.removeItem(REFRESH_KEY) }

export function isAuthenticated(): boolean { return Boolean(getToken()) }

export function clearSession(): void {
  clearToken()
  clearRefreshToken()
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IUser {
  id: string
  email: string
  name: string
  plan: string
  created_at: string
}

export interface IAuthResponse {
  token: string
  refresh_token: string
  expires_in: number
  user: IUser
}

export interface IDevice {
  id: string
  name: string
  version: string
  platform: string
  status: 'online' | 'offline'
  last_seen_at: string | null
  registered_at: string
}

export interface IMiniApp {
  id: string
  slug: string
  name: string
  description: string
  category: string
  developer: string
  version: string
  icon_url: string
  rating: number
  install_count: number
  is_free: boolean
  price_usd: number | null
  permissions: string[]
  changelog: string
  installed: boolean
}

export interface IWorkspace {
  id: string
  name: string
  app_id: string
  app_name: string
  app_slug: string
  created_at: string
  updated_at: string
}

export interface IWorkspaceRun {
  id: string
  workspace_id: string
  input: string
  output: string
  status: 'running' | 'completed' | 'failed'
  tokens_used: number
  model: string
  created_at: string
}

export interface IBot {
  id: string
  name: string
  description: string
  goal: string
  status: 'active' | 'paused'
  created_at: string
  updated_at: string
}

export interface IBotRun {
  id: string
  bot_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  steps: number
  result: string
  started_at: string
  ended_at?: string
}

export interface ICreateBotInput {
  name: string
  description: string
  goal: string
}

export interface IUpdateBotInput {
  name: string
  description: string
  goal: string
  status: 'active' | 'paused'
}

// ── HTTP core ─────────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retry = true,
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh()
    if (refreshed) return request<T>(method, path, body, false)
    clearSession()
    throw new Error('SESSION_EXPIRED')
  }

  if (res.status === 204) return undefined as T

  const json = await res.json()
  if (!res.ok) {
    const msg = (json as { message?: string }).message ?? `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json as T
}

async function tryRefresh(): Promise<boolean> {
  const rt = getRefreshToken()
  if (!rt) return false
  try {
    const res = await fetch(`${GATEWAY}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    })
    if (!res.ok) return false
    const data = await res.json() as IAuthResponse
    setToken(data.token)
    setRefreshToken(data.refresh_token)
    return true
  } catch {
    return false
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/** Register a new account and store the issued tokens. */
export async function register(email: string, name: string, password: string): Promise<IAuthResponse> {
  const res = await fetch(`${GATEWAY}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password }),
  })
  if (!res.ok) {
    const err = await res.json() as { message?: string }
    throw new Error(err.message ?? 'Registration failed')
  }
  const data = await res.json() as IAuthResponse
  setToken(data.token)
  setRefreshToken(data.refresh_token)
  return data
}

/** Login with email and password, store the issued tokens. */
export async function loginWithEmail(email: string, password: string): Promise<IAuthResponse> {
  const res = await fetch(`${GATEWAY}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json() as { message?: string }
    throw new Error(err.message ?? 'Invalid credentials')
  }
  const data = await res.json() as IAuthResponse
  setToken(data.token)
  setRefreshToken(data.refresh_token)
  return data
}

/** Legacy API-key login used by the Desktop Agent. */
export async function login(clientId: string, clientSecret: string): Promise<void> {
  const res = await fetch(`${GATEWAY}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  })
  if (!res.ok) throw new Error('Invalid credentials')
  const data = await res.json() as { access_token: string }
  setToken(data.access_token)
}

export const authApi = {
  me: (): Promise<IUser> =>
    request<IUser>('GET', '/v1/auth/me'),

  logout: (refreshToken: string): Promise<void> =>
    request<void>('POST', '/v1/auth/logout', { refresh_token: refreshToken }),

  logoutAll: (): Promise<void> =>
    request<void>('POST', '/v1/auth/logout-all'),

  changePassword: (currentPassword: string, newPassword: string): Promise<void> =>
    request<void>('POST', '/v1/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),

  deleteAccount: (): Promise<void> =>
    request<void>('DELETE', '/v1/auth/account'),
}

// ── Devices ───────────────────────────────────────────────────────────────────

export const devicesApi = {
  list: (): Promise<IDevice[]> =>
    request<IDevice[]>('GET', '/v1/devices'),

  register: (name: string, platform: string, version: string): Promise<IDevice> =>
    request<IDevice>('POST', '/v1/devices', { name, platform, version }),

  rename: (id: string, name: string): Promise<IDevice> =>
    request<IDevice>('PATCH', `/v1/devices/${id}`, { name }),

  remove: (id: string): Promise<void> =>
    request<void>('DELETE', `/v1/devices/${id}`),

  heartbeat: (id: string): Promise<void> =>
    request<void>('POST', `/v1/devices/${id}/heartbeat`),
}

// ── Marketplace ───────────────────────────────────────────────────────────────

export const marketplaceApi = {
  list: (query = '', category = ''): Promise<IMiniApp[]> => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (category && category !== 'all') params.set('category', category)
    const qs = params.toString()
    return request<IMiniApp[]>('GET', `/v1/marketplace${qs ? `?${qs}` : ''}`)
  },

  get: (idOrSlug: string): Promise<IMiniApp> =>
    request<IMiniApp>('GET', `/v1/marketplace/${idOrSlug}`),

  getInstalled: (): Promise<IMiniApp[]> =>
    request<IMiniApp[]>('GET', '/v1/marketplace/installed'),

  install: (appId: string): Promise<void> =>
    request<void>('POST', `/v1/marketplace/${appId}/install`),

  uninstall: (appId: string): Promise<void> =>
    request<void>('DELETE', `/v1/marketplace/${appId}/install`),
}

// ── Workspaces ────────────────────────────────────────────────────────────────

export const workspacesApi = {
  list: (): Promise<IWorkspace[]> =>
    request<IWorkspace[]>('GET', '/v1/workspaces'),

  create: (name: string, appId?: string): Promise<IWorkspace> =>
    request<IWorkspace>('POST', '/v1/workspaces', { name, app_id: appId ?? '' }),

  get: (id: string): Promise<IWorkspace> =>
    request<IWorkspace>('GET', `/v1/workspaces/${id}`),

  update: (id: string, name: string): Promise<IWorkspace> =>
    request<IWorkspace>('PATCH', `/v1/workspaces/${id}`, { name }),

  delete: (id: string): Promise<void> =>
    request<void>('DELETE', `/v1/workspaces/${id}`),

  getRuns: (id: string, limit = 50): Promise<IWorkspaceRun[]> =>
    request<IWorkspaceRun[]>('GET', `/v1/workspaces/${id}/runs?limit=${limit}`),

  saveRun: (
    workspaceId: string,
    input: string,
    output: string,
    tokensUsed: number,
    model: string,
  ): Promise<IWorkspaceRun> =>
    request<IWorkspaceRun>('POST', `/v1/workspaces/${workspaceId}/runs`, {
      input, output, tokens_used: tokensUsed, model, status: 'completed',
    }),

  getRun: (workspaceId: string, runId: string): Promise<IWorkspaceRun> =>
    request<IWorkspaceRun>('GET', `/v1/workspaces/${workspaceId}/runs/${runId}`),
}

// ── Bots (Automation System) ──────────────────────────────────────────────────

export const botsApi = {
  list: (): Promise<IBot[]> =>
    request<IBot[]>('GET', '/v1/bots'),

  create: (input: ICreateBotInput): Promise<IBot> =>
    request<IBot>('POST', '/v1/bots', input),

  get: (id: string): Promise<IBot> =>
    request<IBot>('GET', `/v1/bots/${id}`),

  update: (id: string, input: IUpdateBotInput): Promise<IBot> =>
    request<IBot>('PUT', `/v1/bots/${id}`, input),

  delete: (id: string): Promise<void> =>
    request<void>('DELETE', `/v1/bots/${id}`),

  start: (id: string): Promise<{ run_id: string; status: string }> =>
    request('POST', `/v1/bots/${id}/runs`),

  getRuns: (id: string, limit = 20): Promise<IBotRun[]> =>
    request<IBotRun[]>('GET', `/v1/bots/${id}/runs?limit=${limit}`),
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface IPlatformStats {
  total_devices: number
  online_devices: number
  total_installs: number
  total_bots: number
  total_bot_runs: number
  total_workspaces: number
}

export const statsApi = {
  get: (): Promise<IPlatformStats> =>
    request<IPlatformStats>('GET', '/v1/stats'),
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface IAppReview {
  id: string
  app_id: string
  user_id: string
  user_name: string
  rating: number
  body: string
  created_at: string
  updated_at: string
}

export const reviewsApi = {
  list: (appId: string, limit = 20): Promise<IAppReview[]> =>
    request<IAppReview[]>('GET', `/v1/marketplace/${appId}/reviews?limit=${limit}`),

  upsert: (appId: string, rating: number, body: string): Promise<IAppReview> =>
    request<IAppReview>('POST', `/v1/marketplace/${appId}/reviews`, { rating, body }),

  delete: (appId: string): Promise<void> =>
    request<void>('DELETE', `/v1/marketplace/${appId}/reviews`),
}
