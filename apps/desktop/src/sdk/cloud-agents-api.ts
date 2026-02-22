/**
 * bot-api.ts
 *
 * Typed HTTP helpers for /v1/bots/*.
 * All calls require an authenticated session — tokenStore must hold a valid JWT.
 * Throws Error('NOT_AUTHENTICATED') when no token is present.
 */

import { tokenStore } from './token-store.js'

const REQUEST_TIMEOUT_MS = 15_000

function baseURL(): string {
  return import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000'
}

async function cloudAgentsFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.getToken()
  if (!token) throw new Error('NOT_AUTHENTICATED')
  const controller = new AbortController()
  const tid = setTimeout(() => { controller.abort() }, REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${baseURL()}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if (res.status === 204) return undefined as T
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`${path} → ${String(res.status)}: ${text}`)
    }
    return res.json() as Promise<T>
  } finally {
    clearTimeout(tid)
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Input for creating or updating a bot. */
export interface ICreateAgentInput {
  name: string
  description: string
  goal?: string
}

/** A bot record returned by the backend. */
export interface ICloudAgent {
  id: string
  name: string
  description: string
  goal: string
  status: 'active' | 'paused'
  created_at: string
  updated_at: string
}

/** A run record returned by the backend. `result` is JSONB or null. */
export interface ICloudAgentRun {
  id: string
  bot_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  steps: number
  result: Record<string, unknown> | null
  started_at: string
  ended_at?: string
}

// ─── API ──────────────────────────────────────────────────────────────────────

/** CRUD and run operations for bots. All methods throw NOT_AUTHENTICATED without a token. */
export const cloudAgentsApi = {
  list: (): Promise<ICloudAgent[]> =>
    cloudAgentsFetch<ICloudAgent[]>('GET', '/v1/bots'),

  create: (input: ICreateAgentInput): Promise<ICloudAgent> =>
    cloudAgentsFetch<ICloudAgent>('POST', '/v1/bots', input),

  update: (
    id: string,
    input: { name: string; description: string; goal?: string; status: 'active' | 'paused' },
  ): Promise<ICloudAgent> =>
    cloudAgentsFetch<ICloudAgent>('PUT', `/v1/bots/${id}`, input),

  delete: async (id: string): Promise<void> => {
    await cloudAgentsFetch<undefined>('DELETE', `/v1/bots/${id}`)
  },

  /** Create a pending run on the server. The desktop agent-loop will pick it up. */
  start: (id: string): Promise<{ run_id: string; status: string }> =>
    cloudAgentsFetch<{ run_id: string; status: string }>('POST', `/v1/bots/${id}/runs`),

  getRuns: (botId: string, limit = 20): Promise<ICloudAgentRun[]> =>
    cloudAgentsFetch<ICloudAgentRun[]>('GET', `/v1/bots/${botId}/runs?limit=${String(limit)}`),

  updateRun: async (
    runId: string,
    status: string,
    steps: number,
    result?: Record<string, unknown>,
  ): Promise<void> => {
    await cloudAgentsFetch<undefined>('PATCH', `/v1/bots/runs/${runId}`, {
      status,
      steps,
      ...(result !== undefined ? { result } : {}),
    })
  },
}
