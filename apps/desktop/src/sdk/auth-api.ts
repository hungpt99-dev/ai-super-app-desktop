/**
 * auth-api.ts
 *
 * Standalone typed HTTP helpers for the /v1/auth/* endpoints.
 *
 * Intentionally uses raw fetch (not GatewayClient) so that auth-store.ts can
 * import these functions without triggering @typescript-eslint cross-file type
 * resolution issues tied to the GatewayClient class hierarchy.
 *
 * All functions read the base URL from the Vite env var at call time, matching
 * the GatewayClient singleton behaviour.
 */

import { tokenStore } from './token-store.js'

// ─── Return types ─────────────────────────────────────────────────────────────

/** Token pair returned by login / register / refresh. */
export interface IAuthTokenPair {
  access_token: string
  refresh_token: string
}

/** User profile returned by GET /v1/auth/me. */
export interface IUserProfile {
  id: string
  email: string
  name: string
  plan: 'free' | 'pro' | 'enterprise'
  created_at: string
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'AuthApiError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function baseURL(): string {
  return (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? 'http://localhost:3000'
}

async function authPost<T>(path: string, body: Record<string, string | undefined>): Promise<T> {
  const res = await fetch(`${baseURL()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new AuthApiError(`${path} → ${String(res.status)}: ${text}`, res.status)
  }
  return res.json() as Promise<T>
}

async function authGet<T>(path: string): Promise<T> {
  const token = tokenStore.getToken()
  const res = await fetch(`${baseURL()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new AuthApiError(`${path} → ${String(res.status)}: ${text}`, res.status)
  }
  return res.json() as Promise<T>
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Exchange email + password for a JWT + refresh token pair. */
export async function authLogin(email: string, password: string): Promise<IAuthTokenPair> {
  return authPost<IAuthTokenPair>('/v1/auth/login', { email, password })
}

/** Create a new account and return tokens (auto-login on register). */
export async function authRegister(
  email: string,
  password: string,
  name?: string,
): Promise<IAuthTokenPair> {
  return authPost<IAuthTokenPair>('/v1/auth/register', { email, password, name })
}

/** Return the authenticated user's profile (requires a valid access token in tokenStore). */
export async function authMe(): Promise<IUserProfile> {
  return authGet<IUserProfile>('/v1/auth/me')
}

/** Revoke a refresh token server-side. */
export async function authLogout(refreshToken: string): Promise<void> {
  await authPost<Record<string, never>>('/v1/auth/logout', { refresh_token: refreshToken })
}

/** Exchange a refresh token for a new access + refresh token pair. */
export async function authRefresh(refreshToken: string): Promise<IAuthTokenPair> {
  return authPost<IAuthTokenPair>('/v1/auth/refresh', { refresh_token: refreshToken })
}
