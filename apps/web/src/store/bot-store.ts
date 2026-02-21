/**
 * bot-store.ts
 *
 * Zustand store for bot management state.
 * Same pattern as apps/desktop stores — pure TypeScript, no Tauri deps.
 */

import { create } from 'zustand'
import { botsApi, type IBot, type IBotRun, type ICreateBotInput } from '../lib/api-client.js'

/** Interval (ms) between auto-refresh polls while at least one run is active. */
const ACTIVE_RUN_POLL_INTERVAL_MS = 5_000

interface IBotStore {
  bots: IBot[]
  selectedBotId: string | null
  runs: Record<string, IBotRun[]> // botId → runs
  loading: boolean
  error: string | null

  fetchBots: () => Promise<void>
  createBot: (input: ICreateBotInput) => Promise<IBot>
  updateBotStatus: (id: string, status: 'active' | 'paused') => Promise<void>
  deleteBot: (id: string) => Promise<void>
  startBot: (id: string) => Promise<string> // returns run_id
  fetchRuns: (botId: string) => Promise<void>
  /**
   * Start polling a bot's runs every ACTIVE_RUN_POLL_INTERVAL_MS.
   * Stops automatically once all runs reach a terminal state.
   * Returns a cleanup function to cancel polling early.
   */
  watchRuns: (botId: string) => () => void
  selectBot: (id: string | null) => void
  clearError: () => void
}

export const useBotStore = create<IBotStore>((set, get) => ({
  bots: [],
  selectedBotId: null,
  runs: {},
  loading: false,
  error: null,

  fetchBots: async () => {
    set({ loading: true, error: null })
    try {
      const bots = await botsApi.list()
      set({ bots, loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  createBot: async (input) => {
    const bot = await botsApi.create(input)
    set((s) => ({ bots: [bot, ...s.bots] }))
    return bot
  },

  updateBotStatus: async (id, status) => {
    const bot = get().bots.find((b) => b.id === id)
    if (!bot) return
    const updated = await botsApi.update(id, {
      name: bot.name,
      description: bot.description,
      goal: bot.goal,
      status,
    })
    set((s) => ({ bots: s.bots.map((b) => (b.id === id ? updated : b)) }))
  },

  deleteBot: async (id) => {
    await botsApi.delete(id)
    set((s) => ({
      bots: s.bots.filter((b) => b.id !== id),
      selectedBotId: s.selectedBotId === id ? null : s.selectedBotId,
    }))
  },

  startBot: async (id) => {
    const { run_id } = await botsApi.start(id)
    // Refresh runs so the new pending run appears immediately.
    await get().fetchRuns(id)
    return run_id
  },

  fetchRuns: async (botId) => {
    const runs = await botsApi.getRuns(botId)
    set((s) => ({ runs: { ...s.runs, [botId]: runs } }))
  },

  watchRuns: (botId) => {
    const TERMINAL = new Set(['completed', 'failed', 'cancelled'])

    const tick = async (): Promise<void> => {
      await get().fetchRuns(botId)
    }

    // Kick off an immediate fetch, then poll on interval.
    void tick()

    const timer = setInterval(() => {
      const current = get().runs[botId] ?? []
      const hasActive = current.some((r) => !TERMINAL.has(r.status))
      if (!hasActive) {
        clearInterval(timer)
        return
      }
      void tick()
    }, ACTIVE_RUN_POLL_INTERVAL_MS)

    return () => { clearInterval(timer) }
  },

  selectBot: (id) => { set({ selectedBotId: id }) },

  clearError: () => { set({ error: null }) },
}))
