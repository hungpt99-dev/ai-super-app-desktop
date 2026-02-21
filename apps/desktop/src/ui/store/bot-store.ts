/**
 * bot-store.ts
 *
 * Local-first bot store for the Desktop app.
 *
 * Architecture
 * ────────────
 * • Local bots  — always available, persisted in localStorage, no auth required.
 * • Cloud bots  — fetched from the backend when authenticated (synced = true).
 * • Run history — stored in localStorage for local bots; fetched from server for
 *                 cloud bots and merged with any local records.
 *
 * The store exposes a unified IDesktopBot[] regardless of auth state.
 * Components read `bot.synced` to decide which capabilities to offer.
 */

import { create } from 'zustand'
import { tokenStore } from '../../sdk/token-store.js'
import { botApi, type ICreateBotInput } from '../../sdk/bot-api.js'
import { getDesktopBridge } from '../lib/bridge.js'

// ─── Local persistence ─────────────────────────────────────────────────────────

const BOTS_KEY = 'ai-superapp-bots'
const RUNS_KEY = 'ai-superapp-bot-runs'
const SEEDED_KEY = 'ai-superapp:bots-seeded-v2'

/** Pre-loaded bots shown on first launch so the Bots tab is never empty. */
const DEFAULT_BOTS: IDesktopBot[] = [
  {
    id: 'seed-morning-digest',
    name: 'Morning Digest',
    description: "Summarises today's top news headlines into a quick read.",
    goal: "Search the web for today's top 5 headlines, summarise each into 1-2 sentences, and output a clean bullet-point digest.",
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    synced: false,
    templateId: 'daily-digest',
  },
  {
    id: 'seed-btc-watch',
    name: 'BTC Price Watch',
    description: 'Monitors BTC/USD price and reports 5 %+ movements.',
    goal: 'Check the current BTC/USD price, compare it to 24 hours ago, and generate a brief report if price moved more than 5 % in either direction.',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    synced: false,
    templateId: 'price-alert',
  },
  {
    id: 'seed-code-reviewer',
    name: 'Code Reviewer',
    description: 'Reviews the latest git commits for bugs and improvements.',
    goal: 'Review the latest git commit diff in the current repository, identify potential bugs, and suggest concrete code improvements.',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    synced: false,
    templateId: 'code-reviewer',
  },
  {
    id: 'seed-crypto-analysis',
    name: 'Crypto Analysis',
    description: 'Live market data + AI analysis for BTC, ETH, SOL and BNB.',
    goal: 'Monitor BTC, ETH, SOL and BNB market data, detect significant price movements, and generate an AI-powered market outlook.',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    synced: false,
    templateId: 'crypto-analysis',
  },
  {
    id: 'seed-writing-helper',
    name: 'Writing Helper',
    description: 'Improve, summarize, expand, translate, or fix grammar in any text.',
    goal: 'Process text using AI to improve clarity, summarize, expand, translate, or fix grammar based on the selected action.',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    synced: false,
    templateId: 'writing-helper',
  },
]

function readBots(): IDesktopBot[] {
  try {
    const raw = localStorage.getItem(BOTS_KEY)
    if (raw !== null) return JSON.parse(raw) as IDesktopBot[]
    // First launch: seed defaults so the Bots tab is never empty.
    if (!localStorage.getItem(SEEDED_KEY)) {
      localStorage.setItem(SEEDED_KEY, '1')
      writeBots(DEFAULT_BOTS)
      return DEFAULT_BOTS
    }
    return []
  } catch { return [] }
}

function writeBots(bots: IDesktopBot[]): void {
  try { localStorage.setItem(BOTS_KEY, JSON.stringify(bots)) } catch { /* ignore */ }
}

function readRuns(): Record<string, IDesktopBotRun[]> {
  try { return JSON.parse(localStorage.getItem(RUNS_KEY) ?? '{}') as Record<string, IDesktopBotRun[]> }
  catch { return {} }
}

function writeRuns(runs: Record<string, IDesktopBotRun[]>): void {
  try { localStorage.setItem(RUNS_KEY, JSON.stringify(runs)) } catch { /* ignore */ }
}

function generateId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** A bot as presented by the desktop UI — may be local-only or cloud-backed. */
export interface IDesktopBot {
  id: string
  name: string
  description: string
  goal: string
  status: 'active' | 'paused'
  created_at: string
  /** true = this bot exists on the backend and is associated with the current account. */
  synced: boolean
  /** The template this bot was created from, if any (local concept — not sent to server). */
  templateId?: string
}

/** A run record — may live in localStorage or be fetched from the server. */
export interface IDesktopBotRun {
  id: string
  bot_id: string
  status: RunStatus
  steps: number
  /** Human-readable output string (server JSON is formatted before storage). */
  result: string
  started_at: string
  ended_at?: string
  /** true = this run exists only in localStorage (not on the server). */
  local: boolean
}

interface IBotStore {
  bots: IDesktopBot[]
  runs: Record<string, IDesktopBotRun[]>
  selectedBotId: string | null
  loading: boolean
  /** IDs of bots currently executing — one entry per bot so multiple bots can run in parallel. */
  runningBotIds: string[]
  error: string | null

  /** Load bots: local always; merged with cloud when authenticated. */
  loadBots(): Promise<void>
  /** Create a bot. On server when authenticated, otherwise local-only. */
  createBot(input: ICreateBotInput & { templateId?: string }): Promise<void>
  /** Delete a bot. Removes from server when synced. */
  deleteBot(id: string): Promise<void>
  /** Toggle active ↔ paused. Updates server when synced. */
  toggleStatus(id: string): Promise<void>
  /**
   * Execute a bot run.
   * • Cloud bot (synced + authenticated): queues on server; agent-loop executes it.
   * • Local bot: executes immediately via bridge (module tool → AI → offline fallback).
   */
  runBot(id: string): Promise<void>
  /** Load run history for a bot (local + server when synced). */
  loadRuns(botId: string): Promise<void>
  /** Update editable fields of a bot (name, description, goal). Local-only for now. */
  updateBot(id: string, patch: Partial<Pick<IDesktopBot, 'name' | 'description' | 'goal'>>): Promise<void>
  selectBot(id: string | null): void
  clearError(): void
}

// ─── Result formatting ────────────────────────────────────────────────────────

function formatResult(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (typeof obj.output === 'string') return obj.output
    if (typeof obj.error === 'string') return `Error: ${obj.error}`
    if (typeof obj.summary === 'string') return obj.summary
    return JSON.stringify(raw)
  }
  return String(raw)
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBotStore = create<IBotStore>((set, get) => ({
  bots: readBots(),
  runs: readRuns(),
  selectedBotId: null,
  loading: false,
  runningBotIds: [],
  error: null,

  loadBots: async () => {
    set({ loading: true, error: null })
    try {
      const local = readBots()

      if (!tokenStore.getToken()) {
        set({ bots: local, loading: false })
        return
      }

      // Authenticated: fetch cloud bots and merge with local-only bots.
      const cloud = await botApi.list()
      const cloudIds = new Set(cloud.map((b) => b.id))

      const synced: IDesktopBot[] = cloud.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        goal: b.goal,
        status: b.status,
        created_at: b.created_at,
        synced: true,
      }))

      // Retain local-only bots that are not already on the server.
      const localOnly = local.filter((b) => !b.synced && !cloudIds.has(b.id))
      const merged = [...synced, ...localOnly]
      writeBots(merged)
      set({ bots: merged, loading: false })
    } catch (err) {
      // Network failure — fall back to cached local bots.
      set({ bots: readBots(), loading: false, error: (err as Error).message })
    }
  },

  createBot: async (input) => {
    set({ loading: true, error: null })
    try {
      if (tokenStore.getToken()) {
        const cloud = await botApi.create(input)
        const bot: IDesktopBot = {
          ...cloud,
          synced: true,
          ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        }
        const bots = [bot, ...get().bots]
        writeBots(bots)
        set({ bots, loading: false })
      } else {
        const bot: IDesktopBot = {
          id: generateId(),
          name: input.name,
          description: input.description,
          goal: input.goal,
          status: 'active',
          created_at: new Date().toISOString(),
          synced: false,
          ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        }
        const bots = [bot, ...get().bots]
        writeBots(bots)
        set({ bots, loading: false })
      }
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
      throw err
    }
  },

  deleteBot: async (id) => {
    const bot = get().bots.find((b) => b.id === id)
    if (!bot) return
    if (bot.synced && tokenStore.getToken()) {
      try {
        await botApi.delete(id)
      } catch (err) {
        set({ error: (err as Error).message })
        return
      }
    }
    const bots = get().bots.filter((b) => b.id !== id)
    const { [id]: _removed, ...remainingRuns } = get().runs
    writeBots(bots)
    writeRuns(remainingRuns)
    set({
      bots,
      runs: remainingRuns,
      selectedBotId: get().selectedBotId === id ? null : get().selectedBotId,
    })
  },

  toggleStatus: async (id) => {
    const bot = get().bots.find((b) => b.id === id)
    if (!bot) return
    const next: 'active' | 'paused' = bot.status === 'active' ? 'paused' : 'active'
    if (bot.synced && tokenStore.getToken()) {
      try {
        await botApi.update(id, {
          name: bot.name,
          description: bot.description,
          goal: bot.goal,
          status: next,
        })
      } catch (err) {
        set({ error: (err as Error).message })
        return
      }
    }
    const bots = get().bots.map((b) => (b.id === id ? { ...b, status: next } : b))
    writeBots(bots)
    set({ bots })
  },

  runBot: async (id) => {
    const bot = get().bots.find((b) => b.id === id)
    // Per-bot lock — the same bot can't be queued twice, but different bots run freely.
    if (!bot || get().runningBotIds.includes(id)) return

    set({ runningBotIds: [...get().runningBotIds, id], error: null })

    const removeLock = (): void => {
      set({ runningBotIds: get().runningBotIds.filter((x) => x !== id) })
    }

    // ── Cloud bot: queue on server; agent-loop handles execution ──────────────
    if (bot.synced && tokenStore.getToken()) {
      try {
        await botApi.start(id)
        await get().loadRuns(id)
      } catch (err) {
        set({ error: (err as Error).message })
      } finally {
        removeLock()
      }
      return
    }

    // ── Local bot: execute immediately via bridge ──────────────────────────────
    const runId = generateId()
    const startedAt = new Date().toISOString()

    const patchRuns = (patch: Partial<IDesktopBotRun>): void => {
      const updated = { ...get().runs }
      updated[id] = (updated[id] ?? []).map((r) =>
        r.id === runId ? { ...r, ...patch } : r,
      )
      writeRuns(updated)
      set({ runs: updated })
    }

    // Insert a 'running' record immediately so the UI reacts.
    const initialRun: IDesktopBotRun = {
      id: runId,
      bot_id: id,
      status: 'running',
      steps: 0,
      result: '',
      started_at: startedAt,
      local: true,
    }
    const withNew = { ...get().runs, [id]: [initialRun, ...(get().runs[id] ?? [])] }
    writeRuns(withNew)
    set({ runs: withNew })

    const bridge = getDesktopBridge()
    let result = ''
    let finalStatus: RunStatus = 'completed'

    try {
      // Layer 1: module tool
      let raw: unknown
      try {
        raw = await bridge.modules.invokeTool('custom', 'run', { goal: bot.goal })
        result = formatResult(raw)
      } catch {
        // Layer 2: cloud AI generation
        try {
          const ai = await bridge.ai.generate('chat', `Complete this task: ${bot.goal}`)
          result = ai.output
        } catch {
          // Layer 3: offline fallback — acknowledge but don't fabricate
          const preview = bot.goal.length > 100 ? `${bot.goal.slice(0, 100)}…` : bot.goal
          result = `Saved locally: "${preview}". Sign in with a paid plan to run AI-powered bots.`
        }
      }
    } catch (err) {
      result = String(err)
      finalStatus = 'failed'
    }

    patchRuns({
      status: finalStatus,
      steps: 1,
      result,
      ended_at: new Date().toISOString(),
    })
    removeLock()
  },

  loadRuns: async (botId) => {
    const bot = get().bots.find((b) => b.id === botId)
    const localAll = readRuns()
    const localRuns = localAll[botId] ?? []

    if (!bot?.synced || !tokenStore.getToken()) {
      set({ runs: { ...get().runs, [botId]: localRuns } })
      return
    }

    try {
      const cloud = await botApi.getRuns(botId)
      const converted: IDesktopBotRun[] = cloud.map((r) => ({
        id: r.id,
        bot_id: r.bot_id,
        status: r.status,
        steps: r.steps,
        result: formatResult(r.result),
        started_at: r.started_at,
        ...(r.ended_at !== undefined ? { ended_at: r.ended_at } : {}),
        local: false,
      }))

      // Keep local-only runs that are not on the server.
      const serverIds = new Set(converted.map((r) => r.id))
      const localOnly = localRuns.filter((r) => r.local && !serverIds.has(r.id))
      const merged = [...converted, ...localOnly].sort(
        (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      )

      const updated = { ...get().runs, [botId]: merged }
      writeRuns(updated)
      set({ runs: updated })
    } catch {
      // Network failure — show cached local runs.
      set({ runs: { ...get().runs, [botId]: localRuns } })
    }
  },

  updateBot: (id, patch) => {
    const bots = get().bots.map((b) => (b.id === id ? { ...b, ...patch } : b))
    writeBots(bots)
    set({ bots })
    return Promise.resolve()
  },

  selectBot: (id) => {
    set({ selectedBotId: id })
    if (id !== null) void get().loadRuns(id)
  },

  clearError: () => { set({ error: null }) },
}))
