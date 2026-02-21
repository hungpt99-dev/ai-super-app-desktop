/**
 * agent-api.ts
 *
 * HTTP helpers for the Desktop Agent:
 *   - Device registration and heartbeat
 *   - Bot run polling (claim pending run) and status reporting
 *
 * Uses raw fetch like auth-api.ts to avoid GatewayClient cross-file type issues.
 */

import { tokenStore } from './token-store.js'

// ─── Device persistence ────────────────────────────────────────────────────────

const DEVICE_ID_KEY = 'ai-superapp-device-id'
const DEVICE_NAME_KEY = 'ai-superapp-device-name'

/** Returns the locally-cached backend device ID, or null if not yet registered. */
export function getStoredDeviceId(): string | null {
  try { return localStorage.getItem(DEVICE_ID_KEY) } catch { return null }
}

/** Persists the backend device ID to localStorage. */
export function saveDeviceId(id: string): void {
  try { localStorage.setItem(DEVICE_ID_KEY, id) } catch { /* ignore */ }
}

/** Persists the device display name to localStorage. */
export function saveDeviceName(name: string): void {
  try { localStorage.setItem(DEVICE_NAME_KEY, name) } catch { /* ignore */ }
}

// ─── HTTP helper ───────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 15_000

function baseURL(): string {
  return (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? 'http://localhost:3000'
}

async function agentFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.getToken()
  const controller = new AbortController()
  const timeout = setTimeout(() => { controller.abort() }, REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${baseURL()}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if (res.status === 204) return undefined as T
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`${method} ${path} → ${String(res.status)}: ${text}`)
    }
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Device record returned by the backend. */
export interface IAgentDevice {
  id: string
  name: string
  platform: string
  version: string
  status: 'online' | 'offline'
  last_seen_at: string | null
  registered_at: string
}

/**
 * Response from GET /v1/bots/poll.
 * The backend returns only the fields needed to claim and execute the run.
 * Note: the backend field is `run_id`, not `id`.
 */
export interface IAgentPollResponse {
  run_id: string
  bot_id: string
  goal: string
  status: string
}

/** Request body for PATCH /v1/bots/runs/{runID}. */
export interface IUpdateRunInput {
  status: 'running' | 'completed' | 'failed'
  steps: number
  result?: string
}

// ─── Device API ────────────────────────────────────────────────────────────────

/** Register this machine as a new device and send periodic heartbeats. */
export const agentDeviceApi = {
  register: (name: string, platform: string, version: string): Promise<IAgentDevice> =>
    agentFetch<IAgentDevice>('POST', '/v1/devices', { name, platform, version }),

  heartbeat: (deviceId: string): Promise<undefined> =>
    agentFetch<undefined>('POST', `/v1/devices/${deviceId}/heartbeat`),

  /**
   * Report live system metrics to the backend (stored in Redis, 5 min TTL).
   * Called by the agent every ~30s alongside the heartbeat.
   */
  reportMetrics: (
    deviceId: string,
    metrics: { cpu_percent: number; mem_percent: number; uptime_seconds: number; tasks_done: number },
  ): Promise<undefined> =>
    agentFetch<undefined>('POST', `/v1/devices/${deviceId}/metrics`, metrics).catch(() => undefined),
}

// ─── Bot polling API ───────────────────────────────────────────────────────────

/** Claim pending runs and report their progress/completion. */
export const agentBotApi = {
  /**
   * Claim the next pending bot run (SKIP LOCKED).
   * Returns null when the queue is empty or on network error.
   */
  poll: (): Promise<IAgentPollResponse | null> =>
    agentFetch<IAgentPollResponse | null>('GET', '/v1/bots/poll').catch(() => null),

  /** Report progress or final status for a claimed run. */
  updateRun: (runId: string, input: IUpdateRunInput): Promise<undefined> =>
    agentFetch<undefined>('PATCH', `/v1/bots/runs/${runId}`, input),
}
