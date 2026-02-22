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
 * The store exposes a unified IDesktopAgent[] regardless of auth state.
 * Components read `bot.synced` to decide which capabilities to offer.
 */

import { create } from 'zustand'
import { tokenStore } from '../../sdk/token-store.js'
import { cloudAgentsApi, type ICreateAgentInput } from '../../sdk/cloud-agents-api.js'
import { getDesktopBridge } from '../lib/bridge.js'
import * as LM from '../../sdk/local-memory.js'
import { AGENT_TEMPLATES, findTemplate } from './agent-templates.js'
import { getDefaultKeyId, listAPIKeys } from '../../sdk/api-key-store.js'

/** True when running inside the full Tauri app (memory commands are available). */
const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Build the private memory scope key for a bot. */
const agentScope = (botId: string): string => `bot:${botId}`
/** Build the ephemeral task scope key for a single run. */
const taskScope = (runId: string): string => `task:${runId}`

/**
 * Resolves AI call options for a bot:
 *   1. Per-bot key if set.
 *   2. Global default BYOK key from api-key-store.
 *   3. undefined (gateway / offline fallback).
 */
async function resolveAiOptions(
  bot: { apiKey?: string; aiProvider?: string },
): Promise<{ apiKey: string; provider: string; model?: string } | undefined> {
  // 1. Bot's own key is always primary.
  if (bot.apiKey) {
    return {
      apiKey: bot.apiKey,
      provider: bot.aiProvider ?? 'openai',
    }
  }
  // 2. No per-bot key — fall back to the user's global default BYOK key.
  try {
    const defaultId = await getDefaultKeyId()
    if (defaultId) {
      const keys = await listAPIKeys()
      const entry = keys.find((k) => k.id === defaultId && k.isActive)
      if (entry) {
        return { apiKey: entry.rawKey, provider: entry.provider, ...(entry.model ? { model: entry.model } : {}) }
      }
    }
  } catch { /* ignore — fall through to gateway */ }
  return undefined
}

/** Push an error toast via the global app-store. Lazy import avoids circular dep. */
function notifyError(title: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  // Lazy-require to avoid a circular dependency (bot-store ← app-store)
  void import('./app-store.js').then(({ useAppStore }) => {
    useAppStore.getState().pushNotification({ level: 'error', title, body: msg })
  })
}

// ─── Local persistence ─────────────────────────────────────────────────────────

const BOTS_KEY = 'agenthub-agents'
const RUNS_KEY = 'agenthub-agent-runs'
/** Bump this key whenever the seed set changes to force a re-seed. */
const SEEDED_KEY = 'agenthub:agents-seeded-v1'

/**
 * Generate the first-launch seed bots from the registered module templates.
 * One bot is created per built-in module template so the Bots tab is
 * never empty on first install — without any hardcoded bot list.
 */
function buildDefaultAgents(): IDesktopAgent[] {
  const seededAt = new Date(0).toISOString() // fixed timestamp so IDs are stable across re-seeds
  return AGENT_TEMPLATES.map((t) => ({
    id: `seed-${t.id}`,
    name: t.name,
    description: t.description,
    status: 'active' as const,
    created_at: seededAt,
    synced: false,
    templateId: t.id,
  }))
}

function readAgents(): IDesktopAgent[] {
  try {
    const raw = localStorage.getItem(BOTS_KEY)
    if (raw !== null) return JSON.parse(raw) as IDesktopAgent[]
    // First launch: seed one bot per built-in module so the tab is never empty.
    if (!localStorage.getItem(SEEDED_KEY)) {
      localStorage.setItem(SEEDED_KEY, '1')
      const defaults = buildDefaultAgents()
      writeAgents(defaults)
      return defaults
    }
    return []
  } catch { return [] }
}

function writeAgents(bots: IDesktopAgent[]): void {
  try { localStorage.setItem(BOTS_KEY, JSON.stringify(bots)) } catch { /* ignore */ }
}

function readRuns(): Record<string, IDesktopAgentRun[]> {
  try { return JSON.parse(localStorage.getItem(RUNS_KEY) ?? '{}') as Record<string, IDesktopAgentRun[]> }
  catch { return {} }
}

function writeRuns(runs: Record<string, IDesktopAgentRun[]>): void {
  try { localStorage.setItem(RUNS_KEY, JSON.stringify(runs)) } catch { /* ignore */ }
}

const CHAT_KEY = 'agenthub-agent-chat'

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

/**
 * A named credential the bot can use when interacting with external services,
 * e.g. `{ key: 'email', value: 'user@example.com', masked: false }` or
 * `{ key: 'password', value: 's3cr3t', masked: true }`.
 * Stored in localStorage only — never sent to the server.
 */
export interface IAgentCredential {
  /** Human-readable key name, e.g. "email", "password", "auth_token". */
  key: string
  /** The credential value. */
  value: string
  /** When true the value is hidden behind ••• in the UI by default. */
  masked: boolean
}

/** A bot as presented by the desktop UI — may be local-only or cloud-backed. */
export interface IDesktopAgent {
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
  /**
   * Named credentials (e.g. login email/password, API tokens) the bot needs to
   * interact with external services. Stored locally only — never sent to the server.
   */
  credentials?: IAgentCredential[]
}

/** A run record — may live in localStorage or be fetched from the server. */
export interface IDesktopAgentRun {
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

interface IAgentsStore {
  agents: IDesktopAgent[]
  runs: Record<string, IDesktopAgentRun[]>
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
  loadAgents(): Promise<void>
  /** Create a bot. On server when authenticated, otherwise local-only. */
  createAgent(input: ICreateAgentInput & { templateId?: string }): Promise<void>
  /** Delete a bot. Removes from server when synced. */
  deleteAgent(id: string): Promise<void>
  /** Toggle active ↔ paused. Updates server when synced. */
  toggleStatus(id: string): Promise<void>
  /**
   * Execute a task run for a bot.
   * • Cloud bot (synced + authenticated): queues on server; agent-loop executes it.
   * • Local bot: executes step-by-step via bridge and posts result to chat history.
   */
  runAgent(id: string): Promise<void>
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
  clearAgentApiKey(id: string): void
  /** Remove the per-bot AI provider override and persist the change. */
  clearAgentAiProvider(id: string): void
  /** Load run history for a bot (local + server when synced). */
  loadRuns(botId: string): Promise<void>
  /** Update editable fields of a bot (name, description, apiKey). Local-only for now. */
  updateAgent(id: string, patch: Partial<Pick<IDesktopAgent, 'name' | 'description' | 'apiKey' | 'aiProvider'>>): Promise<void>
  /** Replace all credentials for a bot and persist locally. */
  updateAgentCredentials(id: string, credentials: IAgentCredential[]): void
  /**
   * Clear the private memory scope for a bot (`bot:{id}`).
   * Soft-deletes all memory entries in that scope.
   */
  clearAgentMemory(botId: string): Promise<void>
  /**
   * Return a context string built from the bot's private memory.
   * Returns an empty string when running in browser dev mode (no Tauri).
   */
  buildAgentMemoryContext(botId: string): Promise<string>
  /**
   * Cancel any active run for the bot — sets its status to 'cancelled' and
   * removes the bot from the running set so the UI unlocks immediately.
   */
  stopAgent(id: string): void
  selectAgent(id: string | null): void
  clearError(): void
}

// ─── Result formatting ─────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((res) => { setTimeout(res, ms) })

const DEFAULT_EXEC_STEPS: readonly [string, string, string, string, string] = [
  'Initialising task…',
  'Processing task…',
  'Executing with AI…',
  'Reviewing output…',
  'Completing run…',
]

/** Resolve execution step labels for a bot from the module registry. */
function getExecSteps(templateId?: string): readonly [string, string, string, string, string] {
  if (!templateId) return DEFAULT_EXEC_STEPS
  return findTemplate(templateId)?.execSteps ?? DEFAULT_EXEC_STEPS
}

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

export const useAgentsStore = create<IAgentsStore>((set, get) => ({
  agents: readAgents(),
  runs: readRuns(),
  chatHistory: readChat(),
  selectedBotId: null,
  loading: false,
  runningBotIds: [],
  thinkingBotIds: [],
  error: null,

  loadAgents: async () => {
    set({ loading: true, error: null })
    try {
      const local = readAgents()

      if (!tokenStore.getToken()) {
        set({ agents: local, loading: false })
        return
      }

      // Authenticated: fetch cloud bots and merge with local-only bots.
      const cloud = await cloudAgentsApi.list()
      const cloudIds = new Set(cloud.map((b) => b.id))

      const synced: IDesktopAgent[] = cloud.map((b) => ({
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
      writeAgents(merged)
      set({ agents: merged, loading: false })
    } catch (err) {
      // Network failure — fall back to cached local bots.
      const msg = err instanceof Error ? err.message : String(err)
      notifyError('Failed to load bots', err)
      set({ agents: readAgents(), loading: false, error: msg })
    }
  },

  createAgent: async (input) => {
    set({ loading: true, error: null })
    try {
      if (tokenStore.getToken()) {
        const cloud = await cloudAgentsApi.create(input)
        const bot: IDesktopAgent = {
          ...cloud,
          synced: true,
          ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        }
        const agents = [bot, ...get().agents]
        writeAgents(agents)
        set({ agents, loading: false })
      } else {
        const bot: IDesktopAgent = {
          id: generateId(),
          name: input.name,
          description: input.description,
          status: 'active',
          created_at: new Date().toISOString(),
          synced: false,
          ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        }
        const agents = [bot, ...get().agents]
        writeAgents(agents)
        set({ agents, loading: false })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      notifyError('Failed to create bot', err)
      set({ loading: false, error: msg })
      throw err
    }
  },

  deleteAgent: async (id) => {
    const bot = get().agents.find((b) => b.id === id)
    if (!bot) return
    // Best-effort cloud delete — never block local deletion on API failure.
    if (bot.synced && tokenStore.getToken()) {
      try {
        await cloudAgentsApi.delete(id)
      } catch (err) {
        notifyError('Cloud sync: failed to delete bot remotely', err)
        // Fall through — still delete locally.
      }
    }
    const agents = get().agents.filter((b) => b.id !== id)
    const { [id]: _removed, ...remainingRuns } = get().runs
    writeAgents(agents)
    writeRuns(remainingRuns)
    set({
      agents,
      runs: remainingRuns,
      selectedBotId: get().selectedBotId === id ? null : get().selectedBotId,
    })
  },

  toggleStatus: async (id) => {
    const bot = get().agents.find((b) => b.id === id)
    if (!bot) return
    const next: 'active' | 'paused' = bot.status === 'active' ? 'paused' : 'active'
    if (bot.synced && tokenStore.getToken()) {
      try {
        await cloudAgentsApi.update(id, {
          name: bot.name,
          description: bot.description,
          status: next,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        notifyError('Failed to update bot status', err)
        set({ error: msg })
        return
      }
    }
    const agents = get().agents.map((b) => (b.id === id ? { ...b, status: next } : b))
    writeAgents(agents)
    set({ agents })
  },

  runAgent: async (id) => {
    const bot = get().agents.find((b) => b.id === id)
    // Per-bot lock — the same bot can't be queued twice, but different bots run freely.
    if (!bot || get().runningBotIds.includes(id)) return
    // Reject commands when the bot has been stopped / paused.
    if (bot.status === 'paused') {
      void import('./app-store.js').then(({ useAppStore }) => {
        useAppStore.getState().pushNotification({
          level: 'warning',
          title: `${bot.name} is paused`,
          body: 'Activate the bot first — use the Activate button in the header or Settings tab.',
        })
      })
      return
    }

    set({ runningBotIds: [...get().runningBotIds, id], error: null })

    const removeLock = (): void => {
      set({ runningBotIds: get().runningBotIds.filter((x) => x !== id) })
    }

    // ── Cloud bot: queue on server; agent-loop handles execution ──────────────
    if (bot.synced && tokenStore.getToken()) {
      try {
        await cloudAgentsApi.start(id)
        await get().loadRuns(id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        notifyError('Failed to queue bot run', err)
        set({ error: msg })
      } finally {
        removeLock()
      }
      return
    }

    // ── Local bot: execute step-by-step via bridge ────────────────────────────
    const runId     = generateId()
    const startedAt = new Date().toISOString()
    const execSteps: readonly string[] = getExecSteps(bot.templateId)

    const patchRuns = (patch: Partial<IDesktopAgentRun>): void => {
      const updated = { ...get().runs }
      updated[id] = (updated[id] ?? []).map((r) =>
        r.id === runId ? { ...r, ...patch } : r,
      )
      writeRuns(updated)
      set({ runs: updated })
    }

    // Insert a 'running' record immediately so the UI reacts.
    const initialRun: IDesktopAgentRun = {
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
            // Build private memory context for this bot (Tauri only).
            let memoryContext = ''
            if (IS_TAURI) {
              try { memoryContext = await LM.memoryBuildContext({ scope: agentScope(id) }) } catch { /* ignore */ }
            }

            const aiOptions = await resolveAiOptions(bot)
            const taskPrompt = memoryContext
              ? `${memoryContext}\n\nTask: ${bot.description}`
              : `Complete this task: ${bot.description}`
            const ai = await bridge.ai.generate('chat', taskPrompt, undefined, aiOptions)
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
      notifyError(`Bot run failed — ${bot.name}`, err)
    }

    patchRuns({
      status: finalStatus,
      steps: execSteps.length,
      logs: execSteps.slice(),
      result,
      ended_at: new Date().toISOString(),
    })

    // Purge ephemeral task-scoped memory now that the run is done.
    if (IS_TAURI) {
      try {
        const taskEntries = await LM.memoryList({ scope: taskScope(runId) })
        await Promise.all(taskEntries.map((e) => LM.memoryDelete(e.id)))
      } catch { /* non-fatal */ }
    }

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
    const bot = get().agents.find((b) => b.id === botId)
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

      // Pull private memory context for this bot (Tauri only).
      let memCtx = ''
      if (IS_TAURI) {
        try { memCtx = await LM.memoryBuildContext({ scope: agentScope(botId) }) } catch { /* ignore */ }
      }

      const prompt = [
        memCtx ? memCtx : null,
        `You are "${bot.name}", a focused AI agent. Your purpose: ${bot.description}`,
        contextLines ? `\nRecent conversation:\n${contextLines}` : null,
        `\nUser: ${content}\nBot:`,
      ].filter(Boolean).join('\n')

      const aiOptions = await resolveAiOptions(bot)
      const ai = await bridge.ai.generate('chat', prompt, undefined, aiOptions)

      const reply = ai.output.startsWith('[Dev mode]')
        ? `[Offline] Start the full Tauri app to enable AI responses from ${bot.name}.`
        : ai.output

      pushMsg({ id: generateId(), role: 'assistant', content: reply, ts: Date.now() })
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      const isConnectionError =
        raw.includes('error sending request') ||
        raw.includes('Connection refused') ||
        raw.includes('ECONNREFUSED') ||
        raw.includes('Failed to fetch')
      const userMsg = isConnectionError
        ? 'Cannot reach the AI gateway. Make sure the backend is running, or add a BYOK API key in Settings.'
        : raw
      notifyError(`${bot.name} encountered an error`, new Error(userMsg))
      pushMsg({ id: generateId(), role: 'assistant', content: `Error: ${userMsg}`, ts: Date.now() })
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
    await get().runAgent(botId)
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

  clearAgentApiKey: (id) => {
    const agents = get().agents.map((b) => {
      if (b.id !== id) return b
      const { apiKey: _k, ...rest } = b
      return rest as IDesktopAgent
    })
    writeAgents(agents)
    set({ agents })
  },

  clearAgentAiProvider: (id) => {
    const agents = get().agents.map((b) => {
      if (b.id !== id) return b
      const { aiProvider: _p, ...rest } = b
      return rest as IDesktopAgent
    })
    writeAgents(agents)
    set({ agents })
  },

  loadRuns: async (botId) => {
    const bot = get().agents.find((b) => b.id === botId)
    const localAll = readRuns()
    const localRuns = localAll[botId] ?? []

    if (!bot?.synced || !tokenStore.getToken()) {
      set({ runs: { ...get().runs, [botId]: localRuns } })
      return
    }

    try {
      const cloud = await cloudAgentsApi.getRuns(botId)
      const converted: IDesktopAgentRun[] = cloud.map((r) => ({
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

  updateAgent: (id, patch) => {
    const agents = get().agents.map((b) => (b.id === id ? { ...b, ...patch } : b))
    writeAgents(agents)
    set({ agents })
    return Promise.resolve()
  },

  updateAgentCredentials: (id, credentials) => {
    const agents = get().agents.map((b) => (b.id === id ? { ...b, credentials } : b))
    writeAgents(agents)
    set({ agents })
  },

  clearAgentMemory: async (botId) => {
    if (!IS_TAURI) return
    try {
      const entries = await LM.memoryList({ scope: agentScope(botId) })
      await Promise.all(entries.map((e) => LM.memoryDelete(e.id)))
    } catch (err) {
      notifyError('Failed to clear bot memory', err)
    }
  },

  buildAgentMemoryContext: async (botId) => {
    if (!IS_TAURI) return ''
    try {
      return await LM.memoryBuildContext({ scope: agentScope(botId) })
    } catch {
      return ''
    }
  },

  stopAgent: (id) => {
    // Immediately unblock the running lock so the UI responds.
    set({ runningBotIds: get().runningBotIds.filter((x) => x !== id) })
    // Set status to paused so bot rejects all future runAgent / sendMessage calls.
    const agents = get().agents.map((b) => b.id === id ? { ...b, status: 'paused' as const } : b)
    writeAgents(agents)
    set({ agents })
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

  selectAgent: (id) => {
    set({ selectedBotId: id })
    if (id !== null) void get().loadRuns(id)
  },

  clearError: () => { set({ error: null }) },
}))
