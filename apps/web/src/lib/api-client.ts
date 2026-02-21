/**
 * api-client.ts
 *
 * HTTP client for the AI SuperApp backend.
 * Handles JWT access tokens + refresh token rotation automatically.
 */

const GATEWAY = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000'

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

/**
 * Redirect the browser to the backend's OAuth initiation endpoint.
 * The backend proxies to the provider and, after success, redirects to
 * `${origin}/oauth/callback?access_token=<jwt>&refresh_token=<rt>`.
 */
export function initiateOAuthLogin(provider: 'google' | 'github'): void {
  const redirectUri = encodeURIComponent(`${window.location.origin}/oauth/callback`)
  window.location.href = `${GATEWAY}/v1/auth/oauth/${provider}?redirect_uri=${redirectUri}`
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IUser {
  id: string
  email: string
  name: string
  plan: 'free' | 'pro' | 'enterprise'
  created_at: string
}

export interface IAuthResponse {
  access_token: string
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

/**
 * A bot published in the Marketplace.
 * Developers create and publish bots; users install them on their devices.
 */
export interface IMarketplaceBot {
  id: string
  slug: string
  name: string
  description: string
  category: string
  developer: string
  developer_id?: string
  version: string
  icon_url?: string
  rating: number
  install_count: number
  is_free: boolean
  price_usd: number | null
  permissions: string[]
  changelog: string
  installed: boolean
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

const REQUEST_TIMEOUT_MS = 15_000

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retry = true,
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const controller = new AbortController()
  const timeout = setTimeout(() => { controller.abort() }, REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${GATEWAY}${path}`, {
      method,
      signal: controller.signal,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } finally {
    clearTimeout(timeout)
  }

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh()
    if (refreshed) return request<T>(method, path, body, false)
    clearSession()
    throw new Error('SESSION_EXPIRED')
  }

  if (res.status === 204) return undefined as T

  const json: unknown = await res.json()
  if (!res.ok) {
    const msg = (json as { message?: string }).message ?? `HTTP ${String(res.status)}`
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
    setToken(data.access_token)
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
  setToken(data.access_token)
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
  setToken(data.access_token)
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

  logout: async (refreshToken: string): Promise<void> => {
    await request('POST', '/v1/auth/logout', { refresh_token: refreshToken })
  },

  logoutAll: async (): Promise<void> => {
    await request('POST', '/v1/auth/logout-all')
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await request('POST', '/v1/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
  },

  deleteAccount: async (): Promise<void> => {
    await request('DELETE', '/v1/auth/account')
  },
}

// ── Devices ───────────────────────────────────────────────────────────────────

/** Live agent system metrics — stored in Redis with a 5 min TTL. */
export interface IDeviceMetrics {
  device_id: string
  cpu_percent: number
  mem_percent: number
  uptime_seconds: number
  tasks_done: number
  updated_at: string | null
}

export const devicesApi = {
  list: (): Promise<IDevice[]> =>
    request<IDevice[]>('GET', '/v1/devices'),

  register: (name: string, platform: string, version: string): Promise<IDevice> =>
    request<IDevice>('POST', '/v1/devices', { name, platform, version }),

  rename: (id: string, name: string): Promise<IDevice> =>
    request<IDevice>('PATCH', `/v1/devices/${id}`, { name }),

  remove: async (id: string): Promise<void> => {
    await request('DELETE', `/v1/devices/${id}`)
  },

  heartbeat: async (id: string): Promise<void> => {
    await request('POST', `/v1/devices/${id}/heartbeat`)
  },

  /** Fetch the latest reported metrics for a device (returns null if none yet or on error). */
  getMetrics: (id: string): Promise<IDeviceMetrics | null> => fetchDeviceMetrics(id),
}

/**
 * Standalone metrics fetch — extracted so ESLint/TS can infer the return type
 * cleanly without the object-literal inference ambiguity.
 */
async function fetchDeviceMetrics(id: string): Promise<IDeviceMetrics | null> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const controller = new AbortController()
  const timeout = setTimeout(() => { controller.abort() }, REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${GATEWAY}/v1/devices/${id}/metrics`, {
      method: 'GET',
      signal: controller.signal,
      headers,
    })
    if (res.status === 204 || res.status === 404) return null
    if (!res.ok) return null
    return (await res.json()) as IDeviceMetrics
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ── Marketplace ───────────────────────────────────────────────────────────────

/** Browse, install and uninstall bots from the Marketplace. */
export const marketplaceApi = {
  list: (query = '', category = ''): Promise<IMarketplaceBot[]> => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (category && category !== 'all') params.set('category', category)
    const qs = params.toString()
    return request<IMarketplaceBot[]>('GET', `/v1/marketplace${qs ? `?${qs}` : ''}`)
  },

  get: (idOrSlug: string): Promise<IMarketplaceBot> =>
    request<IMarketplaceBot>('GET', `/v1/marketplace/${idOrSlug}`),

  getInstalled: (): Promise<IMarketplaceBot[]> =>
    request<IMarketplaceBot[]>('GET', '/v1/marketplace/installed'),

  install: async (appId: string): Promise<void> => {
    await request('POST', `/v1/marketplace/${appId}/install`)
  },

  uninstall: async (appId: string): Promise<void> => {
    await request('DELETE', `/v1/marketplace/${appId}/install`)
  },
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

  delete: async (id: string): Promise<void> => {
    await request('DELETE', `/v1/bots/${id}`)
  },

  /**
   * Dispatch a bot run, optionally with a JSON-serialised task input.
   * The Desktop Agent Bot Worker reads `input` to know what to execute.
   */
  start: (id: string, input?: string): Promise<{ run_id: string; status: string }> =>
    request('POST', `/v1/bots/${id}/runs`, input !== undefined ? { input } : undefined),

  getRuns: (id: string, limit = 20): Promise<IBotRun[]> =>
    request<IBotRun[]>('GET', `/v1/bots/${id}/runs?limit=${String(limit)}`),

  /** Report progress or final status for a bot run (used by web Control Tower). */
  updateRun: async (
    runId: string,
    status: 'running' | 'completed' | 'failed',
    steps: number,
    result?: string,
  ): Promise<void> => {
    await request('PATCH', `/v1/bots/runs/${runId}`, {
      status,
      steps,
      ...(result !== undefined ? { result } : {}),
    })
  },
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface IPlatformStats {
  total_devices: number
  online_devices: number
  total_installs: number
  total_bots: number
  total_bot_runs: number
}

export const statsApi = {
  get: (): Promise<IPlatformStats> =>
    request<IPlatformStats>('GET', '/v1/stats'),
}

// ── Reviews ───────────────────────────────────────────────────────────────────

/** Per-bot marketplace reviews. */
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
    request<IAppReview[]>('GET', `/v1/marketplace/${appId}/reviews?limit=${String(limit)}`),

  upsert: (appId: string, rating: number, body: string): Promise<IAppReview> =>
    request<IAppReview>('POST', `/v1/marketplace/${appId}/reviews`, { rating, body }),

  delete: async (appId: string): Promise<void> => {
    await request('DELETE', `/v1/marketplace/${appId}/reviews`)
  },
}
