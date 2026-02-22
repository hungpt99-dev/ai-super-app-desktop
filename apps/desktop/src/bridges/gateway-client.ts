import { GatewayError, RateLimitError, AuthError } from '@agenthub/shared'
import { logger } from '@agenthub/shared'

const log = logger.child('GatewayClient')

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 500

export interface IGatewayClientOptions {
  baseURL: string
  /** Returns the current Bearer token. Called on every request. */
  getToken: () => string
  timeoutMs?: number
  maxRetries?: number
}

export interface IHealthReport {
  status: 'ok' | 'degraded' | 'down'
  components: Record<string, string>
  timestamp: string
}

export interface IUsageSummary {
  user_id: string
  input_tokens: number
  output_tokens: number
  window_start_unix: number
}

export interface IAuthTokens {
  access_token: string
  refresh_token: string
}

export interface IUserProfile {
  id: string
  email: string
  name: string
  plan: 'free' | 'pro' | 'enterprise'
  created_at: string
}

/**
 * GatewayClient — Gateway Pattern + Retry Pattern.
 *
 * Single typed HTTP client for ALL calls to the Go backend.
 * Responsibilities:
 *   - Auth header injection (via token callback)
 *   - Timeout enforcement (AbortController)
 *   - Exponential backoff retry for 5xx / network errors
 *   - SSE streaming with proper data-line parsing
 *   - Typed error mapping (4xx → AuthError | RateLimitError | GatewayError)
 *
 * Usage:
 *   export const gatewayClient = new GatewayClient({ baseURL, getToken })
 *   const data = await gatewayClient.post<MyType>('/v1/ai/generate', body)
 *   for await (const chunk of gatewayClient.stream('/v1/ai/stream', body)) { ... }
 */
export class GatewayClient {
  private readonly baseURL: string
  private readonly getToken: () => string
  private readonly timeoutMs: number
  private readonly maxRetries: number

  constructor(opts: IGatewayClientOptions) {
    this.baseURL = opts.baseURL.replace(/\/$/, '')
    this.getToken = opts.getToken
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** POST with JSON body, returns parsed JSON response. Retried on 5xx. */
  async post<T>(path: string, body: unknown): Promise<T> {
    return this.withRetry(() => this.json<T>('POST', path, body))
  }

  /** GET, returns parsed JSON response. Retried on 5xx. */
  async get<T>(path: string): Promise<T> {
    return this.withRetry(() => this.json<T>('GET', path, undefined))
  }

  // ── Specialised convenience methods ───────────────────────────────────────

  async checkHealth(): Promise<IHealthReport> {
    try {
      return await this.get<IHealthReport>('/health/detailed')
    } catch {
      return { status: 'down', components: {}, timestamp: new Date().toISOString() }
    }
  }

  async getUsage(): Promise<IUsageSummary> {
    return this.get<IUsageSummary>('/v1/usage')
  }

  /** Exchange email + password for JWT + refresh token. */
  async login(email: string, password: string): Promise<IAuthTokens> {
    return this.post<IAuthTokens>('/v1/auth/login', { email, password })
  }

  /** Create a new account and return tokens (auto-login on register). */
  async register(email: string, password: string, name?: string): Promise<IAuthTokens> {
    return this.post<IAuthTokens>('/v1/auth/register', { email, password, ...(name ? { name } : {}) })
  }

  /** Return the profile of the currently authenticated user. */
  async me(): Promise<IUserProfile> {
    return this.get<IUserProfile>('/v1/auth/me')
  }

  /** Revoke the given refresh token (server-side logout). */
  async logout(refreshToken: string): Promise<void> {
    await this.post<{ ok: true }>('/v1/auth/logout', { refresh_token: refreshToken })
  }

  /** Rotate a refresh token and receive a new access + refresh token pair. */
  async refreshTokens(refreshToken: string): Promise<IAuthTokens> {
    return this.post<IAuthTokens>('/v1/auth/refresh', { refresh_token: refreshToken })
  }

  async issueToken(clientId: string, clientSecret: string): Promise<string> {
    const res = await this.post<{ access_token: string }>('/v1/auth/token', {
      client_id: clientId,
      client_secret: clientSecret,
    })
    return res.access_token
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async json<T>(method: string, path: string, body: unknown): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => { controller.abort() }, this.timeoutMs)

    try {
      const res = await fetch(`${this.baseURL}${path}`, {
        method,
        headers: this.buildHeaders(),
        body: body !== undefined ? JSON.stringify(body) : null,
        signal: controller.signal,
      })

      if (!res.ok) throw this.mapError(res.status, `${method} ${path}`)

      return await res.json() as T
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private buildHeaders(opts: { stream?: boolean } = {}): Record<string, string> {
    const token = this.getToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.stream ? { Accept: 'text/event-stream' } : {}),
    }
  }

  private mapError(status: number, context: string): Error {
    if (status === 401 || status === 403) return new AuthError(`${context} → ${String(status)}`)
    if (status === 429) return new RateLimitError(`${context} → rate limited`)
    return new GatewayError(`${context} → ${String(status)}`, { status })
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (err) {
        // Never retry client errors (4xx)
        if (err instanceof AuthError || err instanceof RateLimitError) throw err
        if (err instanceof GatewayError) {
          const d = err.details
          const status = (d !== null && typeof d === 'object' && 'status' in d && typeof (d as { status?: unknown }).status === 'number')
            ? (d as { status: number }).status
            : 0
          if (status >= 400 && status < 500) throw err
        }

        lastError = err
        if (attempt < this.maxRetries - 1) {
          const base = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, 10_000)
          // ±30 % jitter prevents thundering-herd when multiple clients retry simultaneously.
          const jitter = base * 0.3 * (Math.random() * 2 - 1)
          const delay = Math.round(base + jitter)
          log.warn(`Retrying request (attempt ${String(attempt + 1)}/${String(this.maxRetries)}) after ${String(delay)}ms`)
          await sleep(delay)
        }
      }
    }
    throw lastError
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}
