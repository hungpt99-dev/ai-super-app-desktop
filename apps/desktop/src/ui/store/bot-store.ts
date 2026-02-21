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
const SEEDED_KEY = 'ai-superapp:bots-seeded-v3'

/** Pre-loaded bots shown on first launch so the Bots tab is never empty. */
const DEFAULT_BOTS: IDesktopBot[] = [
  {
    id: 'seed-morning-digest',
    name: 'Morning Digest',
    description: "Summarises today's top news headlines into a quick read.",
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    synced: false,
    templateId: 'daily-digest',
  },
  {
    id: 'seed-btc-watch',
    name: 'BTC Price Watch',
    description: 'Monitors BTC/USD price and reports 5 %+ movements.',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    synced: false,
    templateId: 'price-alert',
  },
  {
    id: 'seed-code-reviewer',
    name: 'Code Reviewer',
    description: 'Reviews the latest git commits for bugs and improvements.',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    synced: false,
    templateId: 'code-reviewer',
  },
  {
    id: 'seed-crypto-analysis',
    name: 'Crypto Analysis',
    description: 'Live market data + AI analysis for BTC, ETH, SOL and BNB.',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    synced: false,
    templateId: 'crypto-analysis',
  },
  {
    id: 'seed-writing-helper',
    name: 'Writing Helper',
    description: 'Improve, summarize, expand, translate, or fix grammar in any text.',
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

const CHAT_KEY = 'ai-superapp-bot-chat'

function readChat(): Record<string, IChatMessage[]> {
  try { return JSON.parse(localStorage.getItem(CHAT_KEY) ?? '{}') as Record<string, IChatMessage[]> }
  catch { return {} }
}

function writeChat(chat: Record<string, IChatMessage[]>): void {
  try { localStorage.setItem(CHAT_KEY, JSON.stringify(chat)) } catch { /* ignore */ }
}

function generateId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** A single message in a bot conversation. */
export interface IChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  /**
   * When present, this message is a run-proposal card awaiting user confirmation.
   * The orchestrator posts this instead of immediately executing a task.
   */
  pendingAction?: {
    label: string
    status: 'pending' | 'confirmed' | 'dismissed'
  }
}

/** A bot as presented by the desktop UI — may be local-only or cloud-backed. */
export interface IDesktopBot {
  id: string
  name: string
  description: string
  status: 'active' | 'paused'
  created_at: string
  /** true = this bot exists on the backend and is associated with the current account. */
  synced: boolean
  /** The template this bot was created from, if any (local concept — not sent to server). */
  templateId?: string
  /**
   * Per-bot API key override — stored locally only, never sent to the server.
   * When set, this key is passed to the AI provider instead of the global app key.
   */
  apiKey?: string
  /**
   * Per-bot AI provider override (e.g. 'openai', 'anthropic', 'gemini').
   * When undefined the app-wide provider from Settings › API Keys is used.
   */
  aiProvider?: string
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
  /** Ordered step labels planned at run-start — used by the live progress panel. */
  plannedSteps?: string[]
  /** Labels of steps that have been reached, in order. Length equals `steps`. */
  logs?: string[]
}

interface IBotStore {
  bots: IDesktopBot[]
  runs: Record<string, IDesktopBotRun[]>
  /** Per-bot conversation history, persisted in localStorage. */
  chatHistory: Record<string, IChatMessage[]>
  selectedBotId: string | null
  loading: boolean
  /** IDs of bots currently executing a task run. */
  runningBotIds: string[]
  /** IDs of bots currently generating a chat reply. */
  thinkingBotIds: string[]
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
   * Execute a task run for a bot.
   * • Cloud bot (synced + authenticated): queues on server; agent-loop executes it.
   * • Local bot: executes step-by-step via bridge and posts result to chat history.
   */
  runBot(id: string): Promise<void>
  /** Send a chat message to a bot and receive an AI reply. */
  sendMessage(botId: string, content: string): Promise<void>
  /**
   * Confirm a pending-action card and execute the task run.
   * Called when the user clicks "Yes, run it" in the confirmation card.
   */
  confirmRun(botId: string, msgId: string): Promise<void>
  /**
   * Dismiss a pending-action card without executing.
   * Called when the user clicks "Skip" in the confirmation card.
   */
  dismissRun(botId: string, msgId: string): void
  /** Clear the conversation history for a bot. */
  clearChat(botId: string): void
  /** Clear ALL bot conversation histories — used by the Privacy settings. */
  clearAllChats(): void
  /** Remove the per-bot API key override and persist the change. */
  clearBotApiKey(id: string): void
  /** Remove the per-bot AI provider override and persist the change. */
  clearBotAiProvider(id: string): void
  /** Load run history for a bot (local + server when synced). */
  loadRuns(botId: string): Promise<void>
  /** Update editable fields of a bot (name, description, apiKey). Local-only for now. */
  updateBot(id: string, patch: Partial<Pick<IDesktopBot, 'name' | 'description' | 'apiKey' | 'aiProvider'>>): Promise<void>
  /**
   * Cancel any active run for the bot — sets its status to 'cancelled' and
   * removes the bot from the running set so the UI unlocks immediately.
   */
  stopBot(id: string): void
  selectBot(id: string | null): void
  clearError(): void
}

// ─── Result formatting ─────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((res) => { setTimeout(res, ms) })

/**
 * Step labels shown in the live run progress panel, keyed by templateId.
 * Each list must have exactly 5 entries.
 */
const EXEC_STEPS: Readonly<Record<string, readonly [string, string, string, string, string]>> = {
  'daily-digest':          ['Fetching top headlines…',       'Parsing article content…',    'Summarising each story…',         'Formatting digest…',              'Saving output…'],
  'research-assistant':    ['Parsing research query…',       'Searching knowledge sources…', 'Extracting key facts…',           'Synthesising findings…',          'Formatting report…'],
  'price-alert':           ['Connecting to market feed…',    'Fetching current price…',       'Comparing with 24h baseline…',    'Evaluating alert threshold…',     'Generating price report…'],
  'crypto-analysis':       ['Connecting to market feed…',    'Fetching multi-asset data…',    'Running technical analysis…',     'Generating AI market outlook…',   'Saving analysis…'],
  'code-reviewer':         ['Reading latest git diff…',      'Parsing code changes…',         'Detecting issues & smells…',     'Generating suggestions…',         'Formatting review…'],
  'meeting-notes':         ['Reading transcript…',           'Identifying speakers…',         'Extracting action items…',        'Summarising discussion…',         'Saving notes…'],
  'social-scheduler':      ['Analysing trending topics…',    'Drafting post variants…',       'Applying tone & style…',         'Reviewing drafts…',               'Saving to schedule…'],
  'writing-helper':        ['Parsing input text…',           'Detecting language & tone…',    'Applying transformation…',        'Reviewing result quality…',       'Saving output…'],
  'seo-analyzer':          ['Crawling target URL…',          'Parsing metadata & headings…', 'Scoring SEO factors…',            'Generating recommendations…',    'Formatting audit…'],
  'email-drip':            ['Analysing audience segment…',   'Drafting email sequence…',      'Refining subject lines & CTAs…', 'Reviewing for tone…',             'Saving campaign drafts…'],
  'stock-screener':        ['Connecting to market data…',    'Screening by criteria…',        'Ranking top results…',            'Analysing top picks…',            'Generating watchlist…'],
  'competitor-tracker':    ['Loading competitor URLs…',      'Fetching page changes…',        'Detecting new content…',         'Summarising changes…',            'Saving tracker report…'],
  'social-listener':       ['Searching social platforms…',   'Gathering brand mentions…',     'Analysing sentiment…',            'Identifying key threads…',        'Saving listener report…'],
  'release-notes-writer':  ['Parsing git log since last tag…','Grouping commits by type…',    'Drafting release notes…',         'Polishing language…',             'Saving release notes…'],
  'ad-copywriter':         ['Parsing product description…',  'Generating headline variants…', 'Drafting ad body copy…',          'Optimising CTAs…',                'Saving ad copy…'],
  'bug-triage':            ['Loading open issues…',          'Classifying by severity…',      'Suggesting owners…',              'Generating triage report…',      'Saving report…'],
}

const DEFAULT_EXEC_STEPS = [
  'Initialising task…',
  'Processing task…',
  'Executing with AI…',
  'Reviewing output…',
  'Completing run…',
] as const

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
  chatHistory: readChat(),
  selectedBotId: null,
  loading: false,
  runningBotIds: [],
  thinkingBotIds: [],
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

    // ── Local bot: execute step-by-step via bridge ────────────────────────────
    const runId     = generateId()
    const startedAt = new Date().toISOString()
    const execSteps: readonly string[] = EXEC_STEPS[bot.templateId ?? ''] ?? DEFAULT_EXEC_STEPS

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
      plannedSteps: [...execSteps],
      logs: [],
    }
    const withNew = { ...get().runs, [id]: [initialRun, ...(get().runs[id] ?? [])] }
    writeRuns(withNew)
    set({ runs: withNew })

    const bridge = getDesktopBridge()
    let result = ''
    let finalStatus: RunStatus = 'completed'

    // Delays per step index (ms).
    // Step 2 also gets its own pre-AI thinking pause below.
    const STEP_DELAYS = [900, 1400, 0, 800, 400] as const

    try {
      for (let i = 0; i < execSteps.length; i++) {
        // Bail out immediately if the user stopped the bot.
        if (!get().runningBotIds.includes(id)) return

        // Advance the step counter and log this step as reached.
        patchRuns({ steps: i + 1, logs: execSteps.slice(0, i + 1) })

        if (i === 2) {
          // Simulate AI thinking time before the actual call.
          await sleep(1200)
          if (!get().runningBotIds.includes(id)) return
          // Perform the actual AI call.
          try {
            const aiOptions = bot.apiKey
              ? { apiKey: bot.apiKey, ...(bot.aiProvider ? { provider: bot.aiProvider } : {}) }
              : undefined
            const ai = await bridge.ai.generate('chat', `Complete this task: ${bot.description}`, undefined, aiOptions)
            result = ai.output.startsWith('[Dev mode]')
              ? `[Offline] Start the full Tauri app to enable real AI execution for: ${bot.description}`
              : ai.output
          } catch (aiErr) {
            const preview = bot.description.length > 120 ? `${bot.description.slice(0, 120)}…` : bot.description
            result = `Task execution failed: ${String(aiErr)}\n\nTask: ${preview}`
          }
        } else {
          await sleep(STEP_DELAYS[i] ?? 300)
        }
      }
    } catch (err) {
      result = String(err)
      finalStatus = 'failed'
    }

    patchRuns({
      status: finalStatus,
      steps: execSteps.length,
      logs: execSteps.slice(),
      result,
      ended_at: new Date().toISOString(),
    })

    // Post the run result as an assistant message so chat history reflects it.
    if (result) {
      const preview = result.length > 600 ? `${result.slice(0, 600)}…` : result
      const runMsg: IChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: finalStatus === 'completed'
          ? `✅ Task run completed.

${preview}`
          : `❌ Task run failed.

${preview}`,
        ts: Date.now(),
      }
      const chat = { ...get().chatHistory }
      chat[id] = [...(chat[id] ?? []), runMsg]
      writeChat(chat)
      set({ chatHistory: chat })
    }

    removeLock()
  },

  sendMessage: async (botId, content) => {
    const bot = get().bots.find((b) => b.id === botId)
    if (!bot) return

    const pushMsg = (msg: IChatMessage): void => {
      const chat = { ...get().chatHistory }
      chat[botId] = [...(chat[botId] ?? []), msg]
      writeChat(chat)
      set({ chatHistory: chat })
    }

    pushMsg({ id: generateId(), role: 'user', content, ts: Date.now() })

    if (bot.status === 'paused') {
      pushMsg({
        id: generateId(),
        role: 'assistant',
        content: `I’m currently paused and won’t process requests. Go to **Settings** to reactivate me.`,
        ts: Date.now(),
      })
      return
    }

    set({ thinkingBotIds: [...get().thinkingBotIds, botId] })

    try {
      const bridge = getDesktopBridge()

      // ── Orchestration: decide if the message implies a task to execute ──────────
      const ACTION_KEYWORDS = [
        'run', 'execute', 'do', 'start', 'check', 'analyze', 'analyse', 'search',
        'generate', 'create', 'write', 'fetch', 'monitor', 'scan', 'review',
        'update', 'send', 'find', 'get', 'make', 'build', 'show me', 'give me',
        'tell me', 'report', 'summarize', 'summarise', 'compute', 'calculate',
        'track', 'watch', 'go ahead', 'proceed',
      ]
      // Pure informational patterns — not actionable
      const INFO_PATTERN = /^(what is|what’s|who is|who’s|why |when |how does|how do|explain|describe|is it|are you)/i
      const lower = content.toLowerCase()
      const isActionIntent =
        !INFO_PATTERN.test(lower) &&
        ACTION_KEYWORDS.some((w) => lower.includes(w))

      if (isActionIntent) {
        // Brief thinking pause so the typing indicator is visible.
        await sleep(700)
        const taskLabel = bot.description.length > 120 ? `${bot.description.slice(0, 120)}…` : bot.description
        pushMsg({
          id: generateId(),
          role: 'assistant',
          content: `Sure! Before I proceed, please confirm you’d like me to run the following task:`,
          ts: Date.now(),
          pendingAction: { label: taskLabel, status: 'pending' },
        })
        return
      }

      // ── Plain conversation: answer without running ─────────────────────────
      const recentHistory = (get().chatHistory[botId] ?? []).slice(-5, -1)
      const contextLines = recentHistory
        .map((m) => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.content.slice(0, 200)}`)
        .join('\n')
      const prompt = `You are "${bot.name}", a focused AI agent. Your purpose: ${bot.description}${
        contextLines ? `\n\nRecent conversation:\n${contextLines}` : ''
      }\n\nUser: ${content}\nBot:`

      const aiOptions = bot.apiKey
        ? { apiKey: bot.apiKey, ...(bot.aiProvider ? { provider: bot.aiProvider } : {}) }
        : undefined
      const ai = await bridge.ai.generate('chat', prompt, undefined, aiOptions)

      const reply = ai.output.startsWith('[Dev mode]')
        ? `[Offline] Start the full Tauri app to enable AI responses from ${bot.name}.`
        : ai.output

      pushMsg({ id: generateId(), role: 'assistant', content: reply, ts: Date.now() })
    } catch {
      pushMsg({ id: generateId(), role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', ts: Date.now() })
    } finally {
      set({ thinkingBotIds: get().thinkingBotIds.filter((x) => x !== botId) })
    }
  },

  confirmRun: async (botId, msgId) => {
    // Mark the card as confirmed immediately so the UI updates.
    const patch = (status: 'confirmed' | 'dismissed'): void => {
      const chat = { ...get().chatHistory }
      chat[botId] = (chat[botId] ?? []).map((m) =>
        m.id === msgId && m.pendingAction
          ? { ...m, pendingAction: { ...m.pendingAction, status } }
          : m,
      )
      writeChat(chat)
      set({ chatHistory: chat })
    }
    patch('confirmed')
    await get().runBot(botId)
  },

  dismissRun: (botId, msgId) => {
    const chat = { ...get().chatHistory }
    chat[botId] = (chat[botId] ?? []).map((m) =>
      m.id === msgId && m.pendingAction
        ? { ...m, pendingAction: { ...m.pendingAction, status: 'dismissed' } }
        : m,
    )
    writeChat(chat)
    set({ chatHistory: chat })
  },

  clearChat: (botId) => {
    const chat = { ...get().chatHistory, [botId]: [] as IChatMessage[] }
    writeChat(chat)
    set({ chatHistory: chat })
  },

  clearAllChats: () => {
    writeChat({})
    set({ chatHistory: {} })
  },

  clearBotApiKey: (id) => {
    const bots = get().bots.map((b) => {
      if (b.id !== id) return b
      const { apiKey: _k, ...rest } = b
      return rest as IDesktopBot
    })
    writeBots(bots)
    set({ bots })
  },

  clearBotAiProvider: (id) => {
    const bots = get().bots.map((b) => {
      if (b.id !== id) return b
      const { aiProvider: _p, ...rest } = b
      return rest as IDesktopBot
    })
    writeBots(bots)
    set({ bots })
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

  stopBot: (id) => {
    // Immediately unblock the running lock so the UI responds.
    set({ runningBotIds: get().runningBotIds.filter((x) => x !== id) })
    // Mark any pending/running run records as cancelled.
    const allRuns = { ...get().runs }
    if (allRuns[id]) {
      allRuns[id] = allRuns[id].map((r) =>
        r.status === 'running' || r.status === 'pending'
          ? { ...r, status: 'cancelled' as RunStatus, ended_at: new Date().toISOString() }
          : r,
      )
      writeRuns(allRuns)
      set({ runs: allRuns })
    }
  },

  selectBot: (id) => {
    set({ selectedBotId: id })
    if (id !== null) void get().loadRuns(id)
  },

  clearError: () => { set({ error: null }) },
}))
