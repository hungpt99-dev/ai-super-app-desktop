/**
 * fetch-interceptor.ts
 *
 * Overrides globalThis.fetch so every request to the backend gateway returns
 * fixture data instead of hitting the real API.
 *
 * Order-sensitive: more specific patterns are matched before generic ones.
 *
 * DEMO ONLY — never imported in production bundles (dynamic import guard in
 * main.tsx ensures tree-shaking eliminates this entire module).
 */

import type { IMarketplaceBot, IBot } from '../api-client.js'
import { setToken, setRefreshToken } from '../api-client.js'
import {
  DEMO_TOKEN,
  DEMO_REFRESH_TOKEN,
  DEMO_AUTH_RESPONSE,
  DEMO_USER,
  DEMO_DEVICES,
  DEMO_DEVICE_METRICS,
  DEMO_BOTS,
  DEMO_MARKETPLACE_BOTS,
  DEMO_BOT_RUNS,
  DEMO_STATS,
  DEMO_REVIEWS,
} from './demo-data.js'

const GATEWAY: string = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000'

// ── Mutable session state ─────────────────────────────────────────────────────

/** Tracks which marketplace bots the demo user has installed. */
let installedBots: IMarketplaceBot[] = DEMO_MARKETPLACE_BOTS.filter((b) => b.installed)

/** Mutable copy of the demo bot list (for create/update/delete). */
let demoBots: IBot[] = [...DEMO_BOTS]

// ── Response helpers ──────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function noContent(): Response {
  return new Response(null, { status: 204 })
}

function notFound(msg = 'Not found'): Response {
  return json({ message: msg }, 404)
}

/** Simulates a realistic API latency (60–180 ms). */
async function simulateLatency(): Promise<void> {
  await new Promise<void>((r) => { setTimeout(r, 60 + Math.random() * 120) })
}

// ── Body helpers ──────────────────────────────────────────────────────────────

function parseBody<T>(init?: RequestInit): T {
  const raw = init?.body
  if (!raw || typeof raw !== 'string') return {} as T
  try { return JSON.parse(raw) as T } catch { return {} as T }
}

// ── Route handler ─────────────────────────────────────────────────────────────

async function handle(url: string, init?: RequestInit): Promise<Response> {
  await simulateLatency()

  const method = (init?.method ?? 'GET').toUpperCase()
  const parsed = new URL(url)
  const path = parsed.pathname  // e.g. "/v1/auth/login"

  // ── Auth ────────────────────────────────────────────────────────────────────

  if (path === '/v1/auth/login' || path === '/v1/auth/register') {
    return json(DEMO_AUTH_RESPONSE)
  }

  if (path === '/v1/auth/refresh') {
    return json(DEMO_AUTH_RESPONSE)
  }

  if (path === '/v1/auth/me') {
    return json(DEMO_USER)
  }

  if (path === '/v1/auth/logout' || path === '/v1/auth/logout-all') {
    return noContent()
  }

  if (path === '/v1/auth/change-password') {
    return noContent()
  }

  if (path === '/v1/auth/account' && method === 'DELETE') {
    return noContent()
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  if (path === '/v1/stats') {
    return json({
      ...DEMO_STATS,
      total_bots: demoBots.length,
      total_installs: installedBots.length,
    })
  }

  // ── Devices ─────────────────────────────────────────────────────────────────

  if (path === '/v1/devices') {
    if (method === 'GET') return json(DEMO_DEVICES)

    if (method === 'POST') {
      const body = parseBody<{ name?: string; platform?: string; version?: string }>(init)
      return json({
        id: `demo-device-${String(Date.now())}`,
        name: body.name ?? 'New Device',
        version: body.version ?? '1.0.0',
        platform: body.platform ?? 'unknown',
        status: 'online',
        last_seen_at: new Date().toISOString(),
        registered_at: new Date().toISOString(),
      }, 201)
    }
  }

  const heartbeatM = /^\/v1\/devices\/([^/]+)\/heartbeat$/.exec(path)
  if (heartbeatM) return noContent()

  const metricsM = /^\/v1\/devices\/([^/]+)\/metrics$/.exec(path)
  if (metricsM) {
    const deviceId = metricsM[1] ?? ''
    const m = DEMO_DEVICE_METRICS[deviceId]
    return m !== undefined ? json(m) : noContent()
  }

  const deviceM = /^\/v1\/devices\/([^/]+)$/.exec(path)
  if (deviceM) {
    const id = deviceM[1]
    const device = DEMO_DEVICES.find((d) => d.id === id)

    if (method === 'PATCH') {
      const body = parseBody<{ name?: string }>(init)
      return device !== undefined
        ? json({ ...device, name: body.name ?? device.name })
        : notFound()
    }

    if (method === 'DELETE') return noContent()
  }

  // ── Marketplace ──────────────────────────────────────────────────────────────

  // Must come before the generic /:id route
  if (path === '/v1/marketplace/installed') {
    return json(installedBots)
  }

  if (path === '/v1/marketplace' && method === 'GET') {
    const q = (parsed.searchParams.get('q') ?? '').toLowerCase()
    const cat = parsed.searchParams.get('category') ?? ''

    let bots = DEMO_MARKETPLACE_BOTS.map((b) => ({
      ...b,
      installed: installedBots.some((ib) => ib.id === b.id),
    }))

    if (q) {
      bots = bots.filter(
        (b) => b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q),
      )
    }
    if (cat && cat !== 'all') {
      bots = bots.filter((b) => b.category === cat)
    }

    return json(bots)
  }

  const installM = /^\/v1\/marketplace\/([^/]+)\/install$/.exec(path)
  if (installM) {
    const botId = installM[1]
    const bot = DEMO_MARKETPLACE_BOTS.find((b) => b.id === botId)

    if (bot !== undefined) {
      if (method === 'POST') {
        if (!installedBots.some((b) => b.id === botId)) {
          installedBots = [...installedBots, { ...bot, installed: true }]
        }
      } else if (method === 'DELETE') {
        installedBots = installedBots.filter((b) => b.id !== botId)
      }
    }
    return noContent()
  }

  const reviewsM = /^\/v1\/marketplace\/([^/]+)\/reviews/.exec(path)
  if (reviewsM) {
    const appId = reviewsM[1]

    if (method === 'GET') {
      return json(DEMO_REVIEWS.filter((r) => r.app_id === appId))
    }

    if (method === 'POST') {
      const body = parseBody<{ rating?: number; body?: string }>(init)
      return json({
        id: `rev-${String(Date.now())}`,
        app_id: appId,
        user_id: DEMO_USER.id,
        user_name: DEMO_USER.name,
        rating: body.rating ?? 5,
        body: body.body ?? '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, 201)
    }

    if (method === 'DELETE') return noContent()
  }

  const mpGetM = /^\/v1\/marketplace\/([^/]+)$/.exec(path)
  if (mpGetM) {
    const slug = mpGetM[1]
    const bot = DEMO_MARKETPLACE_BOTS.find((b) => b.id === slug || b.slug === slug)
    if (!bot) return notFound('Bot not found')
    return json({ ...bot, installed: installedBots.some((ib) => ib.id === bot.id) })
  }

  // ── Bots ────────────────────────────────────────────────────────────────────

  if (path === '/v1/bots') {
    if (method === 'GET') return json(demoBots)

    if (method === 'POST') {
      const body = parseBody<{ name?: string; description?: string; goal?: string }>(init)
      const newBot: IBot = {
        id: `demo-bot-${String(Date.now())}`,
        name: body.name ?? 'New Bot',
        description: body.description ?? '',
        goal: body.goal ?? '',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      demoBots = [newBot, ...demoBots]
      return json(newBot, 201)
    }
  }

  // /v1/bots/runs/:runId  — must come before /v1/bots/:id
  const runUpdateM = /^\/v1\/bots\/runs\/([^/]+)$/.exec(path)
  if (runUpdateM && method === 'PATCH') return noContent()

  const botRunsM = /^\/v1\/bots\/([^/]+)\/runs$/.exec(path)
  if (botRunsM) {
    const botId = botRunsM[1] ?? ''

    if (method === 'GET') {
      return json(DEMO_BOT_RUNS[botId] ?? [])
    }

    if (method === 'POST') {
      return json({ run_id: `run-${String(Date.now())}`, status: 'pending' }, 201)
    }
  }

  const botM = /^\/v1\/bots\/([^/]+)$/.exec(path)
  if (botM) {
    const id = botM[1]
    const bot = demoBots.find((b) => b.id === id)

    if (method === 'GET') {
      return bot !== undefined ? json(bot) : notFound('Bot not found')
    }

    if (method === 'PUT') {
      const body = parseBody<Partial<IBot>>(init)
      const updated = { ...bot, ...body, updated_at: new Date().toISOString() }
      demoBots = demoBots.map((b) => (b.id === id ? updated as IBot : b))
      return json(updated)
    }

    if (method === 'DELETE') {
      demoBots = demoBots.filter((b) => b.id !== id)
      return noContent()
    }
  }

  // ── Fallback ─────────────────────────────────────────────────────────────────

  // eslint-disable-next-line no-console
  console.warn('[Demo] Unhandled route:', method, path)
  return notFound('Demo: route not implemented')
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Replaces globalThis.fetch with a demo interceptor and pre-seeds auth tokens. */
export function installDemoInterceptor(): void {
  const real = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url

    if (url.startsWith(GATEWAY)) {
      return handle(url, init)
    }

    return real(input, init)
  }

  // Pre-seed tokens so isAuthenticated() returns true on first render.
  setToken(DEMO_TOKEN)
  setRefreshToken(DEMO_REFRESH_TOKEN)
}
