/**
 * agents-store.ts
 *
 * Local-first agent store for the Desktop app.
 *
 * Architecture
 * ────────────
 * • Local agents  — always available, persisted in localStorage, no auth required.
 * • Cloud agents  — fetched from the backend when authenticated (synced = true).
 * • Run history — stored in localStorage for local agents; fetched from server for
 *                 cloud agents and merged with any local records.
 *
 * The store exposes a unified IDesktopAgent[] regardless of auth state.
 * Components read `agent.synced` to decide which capabilities to offer.
 */

import { create } from 'zustand'
import { tokenStore } from '../../bridges/token-store.js'
import { cloudAgentsApi, type ICreateAgentInput } from '../../bridges/cloud-agents-api.js'
import { getDesktopBridge } from '../lib/bridge.js'
import * as LM from '../../bridges/local-memory.js'
import { useTemplateRegistry, findTemplate } from './template-registry.js'
import type { IAgentDefaultConfig } from './template-registry.js'
import { getDefaultKeyId, listAPIKeys } from '../../bridges/api-key-store.js'
import {
  IS_TAURI,
  generateId as runtimeGenerateId,
  safeJsonParse,
  migrateAgents,
  debouncedWrite,
  immediateWrite,
  truncateChatHistory,
  AGENT_SCHEMA_VERSION,
} from '../../bridges/runtime.js'

/** Build the private memory scope key for an agent. */
const agentScope = (agentId: string): string => `agent:${agentId}`
/** Build the ephemeral task scope key for a single run. */
const taskScope = (runId: string): string => `task:${runId}`

/**
 * Resolves AI call options for an agent:
 *   1. Per-agent key if set.
 *   2. Global default BYOK key from api-key-store.
 *   3. undefined (gateway / offline fallback).
 */
async function resolveAiOptions(
  agent: { apiKey?: string; aiProvider?: string },
): Promise<{ apiKey: string; provider: string; model?: string } | undefined> {
  // 1. Agent's own key is always primary.
  if (agent.apiKey) {
    return {
      apiKey: agent.apiKey,
      provider: agent.aiProvider ?? 'openai',
    }
  }
  // 2. No per-agent key — fall back to the user's global default BYOK key.
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
  // Lazy-require to avoid a circular dependency (agent-store ← app-store)
  void import('./app-store.js').then(({ useAppStore }) => {
    useAppStore.getState().pushNotification({ level: 'error', title, body: msg })
  })
}

// ─── Local persistence ─────────────────────────────────────────────────────────

const AGENTS_KEY = 'agenthub-agents'
const RUNS_KEY = 'agenthub-agent-runs'
/** Bump this key whenever the seed set changes to force a re-seed. */
const SEEDED_KEY = 'agenthub:agents-seeded-v1'

/**
 * Generate the first-launch seed agents from the registered module templates.
 * One agent is created per built-in module template so the Agents tab is
 * never empty on first install — without any hardcoded agent list.
 */
function buildDefaultAgents(): IDesktopAgent[] {
  const seededAt = new Date(0).toISOString() // fixed timestamp so IDs are stable across re-seeds
  const templates = useTemplateRegistry.getState().templates
  return templates.filter((t) => t.source === 'builtin').map((t) => ({
    id: `seed-${t.id}`,
    name: t.name,
    description: t.description,
    status: 'active' as const,
    created_at: seededAt,
    synced: false,
    templateId: t.id,
    config: { ...t.config },
  }))
}

function readAgents(): IDesktopAgent[] {
  const raw = localStorage.getItem(AGENTS_KEY)
  if (raw !== null) {
    return safeJsonParse<IDesktopAgent[]>(raw, [], migrateAgents)
  }
  // First launch: seed one agent per built-in module so the tab is never empty.
  if (!localStorage.getItem(SEEDED_KEY)) {
    localStorage.setItem(SEEDED_KEY, '1')
    const defaults = buildDefaultAgents()
    writeAgents(defaults)
    return defaults
  }
  return []
}

/** Persist agents immediately (used after creation/deletion). */
function writeAgents(agents: IDesktopAgent[]): void {
  // Stamp schema version on every write.
  const stamped = agents.map((a) => ({ ...a, _schemaVersion: AGENT_SCHEMA_VERSION }))
  immediateWrite(AGENTS_KEY, stamped)
}

/** Persist agents with debounce (used for frequent updates like status toggle). */
function writeAgentsDebounced(agents: IDesktopAgent[]): void {
  const stamped = agents.map((a) => ({ ...a, _schemaVersion: AGENT_SCHEMA_VERSION }))
  debouncedWrite(AGENTS_KEY, stamped)
}

function readRuns(): Record<string, IDesktopAgentRun[]> {
  return safeJsonParse<Record<string, IDesktopAgentRun[]>>(localStorage.getItem(RUNS_KEY), {})
}

function writeRuns(runs: Record<string, IDesktopAgentRun[]>): void {
  debouncedWrite(RUNS_KEY, runs)
}

const CHAT_KEY = 'agenthub-agent-chat'

function readChat(): Record<string, IChatMessage[]> {
  const raw = safeJsonParse<Record<string, IChatMessage[]>>(localStorage.getItem(CHAT_KEY), {})
  return truncateChatHistory(raw)
}

function writeChat(chat: Record<string, IChatMessage[]>): void {
  debouncedWrite(CHAT_KEY, truncateChatHistory(chat))
}

function generateId(): string {
  return runtimeGenerateId('local')
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** A single message in an agent conversation. */
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
 * A named credential the agent can use when interacting with external services,
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

/** An agent as presented by the desktop UI — may be local-only or cloud-backed. */
export interface IDesktopAgent {
  id: string
  name: string
  description: string
  status: 'active' | 'paused'
  created_at: string
  /** true = this agent exists on the backend and is associated with the current account. */
  synced: boolean
  /** The template this agent was created from, if any (local concept — not sent to server). */
  templateId?: string
  // ─── Config overrides (per-instance) ──────────────────────
  /** AI configuration overrides — merged over template defaults at runtime. */
  config: IAgentDefaultConfig
  /**
   * Per-agent API key override — stored locally only, never sent to the server.
   * When set, this key is passed to the AI provider instead of the global app key.
   */
  apiKey?: string
  /**
   * Per-agent AI provider override (e.g. 'openai', 'anthropic', 'gemini').
   * When undefined the app-wide provider from Settings › API Keys is used.
   */
  aiProvider?: string
  /**
   * Named credentials (e.g. login email/password, API tokens) the agent needs to
   * interact with external services. Stored locally only — never sent to the server.
   */
  credentials?: IAgentCredential[]
  /** Tool names toggled off by the user for this instance. */
  disabledTools?: string[]
}

/** A run record — may live in localStorage or be fetched from the server. */
export interface IDesktopAgentRun {
  id: string
  agent_id: string
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
  /** Per-agent conversation history, persisted in localStorage. */
  chatHistory: Record<string, IChatMessage[]>
  selectedAgentId: string | null
  loading: boolean
  /** IDs of agents currently executing a task run. */
  runningAgentIds: string[]
  /** IDs of agents currently generating a chat reply. */
  thinkingAgentIds: string[]
  error: string | null

  /** Load agents: local always; merged with cloud when authenticated. */
  loadAgents(): Promise<void>
  /** Create an agent. On server when authenticated, otherwise local-only. */
  createAgent(input: ICreateAgentInput & { templateId?: string }): Promise<void>
  /** Delete an agent. Removes from server when synced. */
  deleteAgent(id: string): Promise<void>
  /** Toggle active ↔ paused. Updates server when synced. */
  toggleStatus(id: string): Promise<void>
  /**
   * Execute a task run for an agent.
   * • Cloud agent (synced + authenticated): queues on server; agent-loop executes it.
   * • Local agent: executes step-by-step via bridge and posts result to chat history.
   */
  runAgent(id: string): Promise<void>
  /** Send a chat message to an agent and receive an AI reply. */
  sendMessage(agentId: string, content: string): Promise<void>
  /**
   * Confirm a pending-action card and execute the task run.
   * Called when the user clicks "Yes, run it" in the confirmation card.
   */
  confirmRun(agentId: string, msgId: string): Promise<void>
  /**
   * Dismiss a pending-action card without executing.
   * Called when the user clicks "Skip" in the confirmation card.
   */
  dismissRun(agentId: string, msgId: string): void
  /** Clear the conversation history for an agent. */
  clearChat(agentId: string): void
  /** Clear ALL agent conversation histories — used by the Privacy settings. */
  clearAllChats(): void
  /** Remove the per-agent API key override and persist the change. */
  clearAgentApiKey(id: string): void
  /** Remove the per-agent AI provider override and persist the change. */
  clearAgentAiProvider(id: string): void
  /** Load run history for an agent (local + server when synced). */
  loadRuns(agentId: string): Promise<void>
  /** Update editable fields of an agent (name, description, apiKey). Local-only for now. */
  updateAgent(id: string, patch: Partial<Pick<IDesktopAgent, 'name' | 'description' | 'apiKey' | 'aiProvider' | 'config' | 'disabledTools'>>): Promise<void>
  /** Replace all credentials for an agent and persist locally. */
  updateAgentCredentials(id: string, credentials: IAgentCredential[]): void
  /**
   * Clear the private memory scope for an agent (`agent:{id}`).
   * Soft-deletes all memory entries in that scope.
   */
  clearAgentMemory(agentId: string): Promise<void>
  /**
   * Return a context string built from the agent's private memory.
   * Returns an empty string when running in browser dev mode (no Tauri).
   */
  buildAgentMemoryContext(agentId: string): Promise<string>
  /**
   * Cancel any active run for the agent — sets its status to 'cancelled' and
   * removes the agent from the running set so the UI unlocks immediately.
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

/** Resolve execution step labels for an agent from the module registry. */
function getExecSteps(templateId?: string): readonly string[] {
  if (!templateId) return DEFAULT_EXEC_STEPS
  const t = findTemplate(templateId)
  return t?.execSteps ?? DEFAULT_EXEC_STEPS
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
  selectedAgentId: null,
  loading: false,
  runningAgentIds: [],
  thinkingAgentIds: [],
  error: null,

  loadAgents: async () => {
    set({ loading: true, error: null })
    try {
      const local = readAgents()

      if (!tokenStore.getToken()) {
        set({ agents: local, loading: false })
        return
      }

      // Authenticated: fetch cloud agents and merge with local-only agents.
      const cloud = await cloudAgentsApi.list()
      const cloudIds = new Set(cloud.map((b) => b.id))

      const synced: IDesktopAgent[] = cloud.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        status: b.status,
        created_at: b.created_at,
        synced: true,
        config: {},
      }))

      // Retain local-only agents that are not already on the server.
      const localOnly = local.filter((b) => !b.synced && !cloudIds.has(b.id))
      const merged = [...synced, ...localOnly]
      writeAgents(merged)
      set({ agents: merged, loading: false })
    } catch (err) {
      // Network failure — fall back to cached local agents.
      const msg = err instanceof Error ? err.message : String(err)
      notifyError('Failed to load agents', err)
      set({ agents: readAgents(), loading: false, error: msg })
    }
  },

  createAgent: async (input) => {
    set({ loading: true, error: null })
    try {
      if (tokenStore.getToken()) {
        const cloud = await cloudAgentsApi.create(input)
        const agent: IDesktopAgent = {
          ...cloud,
          synced: true,
          config: {},
          ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        }
        const agents = [agent, ...get().agents]
        writeAgents(agents)
        set({ agents, loading: false })
      } else {
        const agent: IDesktopAgent = {
          id: generateId(),
          name: input.name,
          description: input.description,
          status: 'active',
          created_at: new Date().toISOString(),
          synced: false,
          config: {},
          ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        }
        const agents = [agent, ...get().agents]
        writeAgents(agents)
        set({ agents, loading: false })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      notifyError('Failed to create agent', err)
      set({ loading: false, error: msg })
      throw err
    }
  },

  deleteAgent: async (id) => {
    const agent = get().agents.find((b) => b.id === id)
    if (!agent) return
    // Best-effort cloud delete — never block local deletion on API failure.
    if (agent.synced && tokenStore.getToken()) {
      try {
        await cloudAgentsApi.delete(id)
      } catch (err) {
        notifyError('Cloud sync: failed to delete agent remotely', err)
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
      selectedAgentId: get().selectedAgentId === id ? null : get().selectedAgentId,
    })
  },

  toggleStatus: async (id) => {
    const agent = get().agents.find((b) => b.id === id)
    if (!agent) return
    const next: 'active' | 'paused' = agent.status === 'active' ? 'paused' : 'active'
    if (agent.synced && tokenStore.getToken()) {
      try {
        await cloudAgentsApi.update(id, {
          name: agent.name,
          description: agent.description,
          status: next,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        notifyError('Failed to update agent status', err)
        set({ error: msg })
        return
      }
    }
    const agents = get().agents.map((b) => (b.id === id ? { ...b, status: next } : b))
    writeAgents(agents)
    set({ agents })
  },

  runAgent: async (id) => {
    const agent = get().agents.find((b) => b.id === id)
    // Per-agent lock — the same agent can't be queued twice, but different agents run freely.
    if (!agent || get().runningAgentIds.includes(id)) return
    // Reject commands when the agent has been stopped / paused.
    if (agent.status === 'paused') {
      void import('./app-store.js').then(({ useAppStore }) => {
        useAppStore.getState().pushNotification({
          level: 'warning',
          title: `${agent.name} is paused`,
          body: 'Activate the agent first — use the Activate button in the header or Settings tab.',
        })
      })
      return
    }

    set({ runningAgentIds: [...get().runningAgentIds, id], error: null })

    const removeLock = (): void => {
      set({ runningAgentIds: get().runningAgentIds.filter((x) => x !== id) })
    }

    // ── Cloud agent: queue on server; agent-loop handles execution ──────────────
    if (agent.synced && tokenStore.getToken()) {
      try {
        await cloudAgentsApi.start(id)
        await get().loadRuns(id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        notifyError('Failed to queue agent run', err)
        set({ error: msg })
      } finally {
        removeLock()
      }
      return
    }

    // ── Local agent: execute step-by-step via bridge ────────────────────────────
    const runId = generateId()
    const startedAt = new Date().toISOString()
    const execSteps: readonly string[] = getExecSteps(agent.templateId)

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
      agent_id: id,
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
        // Bail out immediately if the user stopped the agent.
        if (!get().runningAgentIds.includes(id)) return

        // Advance the step counter and log this step as reached.
        patchRuns({ steps: i + 1, logs: execSteps.slice(0, i + 1) })

        if (i === 2) {
          // Simulate AI thinking time before the actual call.
          await sleep(1200)
          if (!get().runningAgentIds.includes(id)) return
          // Perform the actual AI call.
          try {
            // Build private memory context for this agent (Tauri only).
            let memoryContext = ''
            if (IS_TAURI) {
              try { memoryContext = await LM.memoryBuildContext({ scope: agentScope(id) }) } catch { /* ignore */ }
            }

            const aiOptions = await resolveAiOptions(agent)
            const taskPrompt = memoryContext
              ? `${memoryContext}\n\nTask: ${agent.description}`
              : `Complete this task: ${agent.description}`
            const ai = await bridge.ai.generate('chat', taskPrompt, undefined, aiOptions)
            result = ai.output.startsWith('[Dev mode]')
              ? `[Offline] Start the full Tauri app to enable real AI execution for: ${agent.description}`
              : ai.output
          } catch (aiErr) {
            const preview = agent.description.length > 120 ? `${agent.description.slice(0, 120)}…` : agent.description
            result = `Task execution failed: ${String(aiErr)}\n\nTask: ${preview}`
          }
        } else {
          await sleep(STEP_DELAYS[i] ?? 300)
        }
      }
    } catch (err) {
      result = String(err)
      finalStatus = 'failed'
      notifyError(`Agent run failed — ${agent.name}`, err)
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

  sendMessage: async (agentId, content) => {
    const agent = get().agents.find((b) => b.id === agentId)
    if (!agent) return

    const pushMsg = (msg: IChatMessage): void => {
      const chat = { ...get().chatHistory }
      chat[agentId] = [...(chat[agentId] ?? []), msg]
      writeChat(chat)
      set({ chatHistory: chat })
    }

    pushMsg({ id: generateId(), role: 'user', content, ts: Date.now() })

    if (agent.status === 'paused') {
      pushMsg({
        id: generateId(),
        role: 'assistant',
        content: `I’m currently paused and won’t process requests. Go to **Settings** to reactivate me.`,
        ts: Date.now(),
      })
      return
    }

    set({ thinkingAgentIds: [...get().thinkingAgentIds, agentId] })

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
        const taskLabel = agent.description.length > 120 ? `${agent.description.slice(0, 120)}…` : agent.description
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
      const recentHistory = (get().chatHistory[agentId] ?? []).slice(-5, -1)
      const contextLines = recentHistory
        .map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content.slice(0, 200)}`)
        .join('\n')

      // Pull private memory context for this agent (Tauri only).
      let memCtx = ''
      if (IS_TAURI) {
        try { memCtx = await LM.memoryBuildContext({ scope: agentScope(agentId) }) } catch { /* ignore */ }
      }

      const prompt = [
        memCtx ? memCtx : null,
        `You are "${agent.name}", a focused AI agent. Your purpose: ${agent.description}`,
        contextLines ? `\nRecent conversation:\n${contextLines}` : null,
        `\nUser: ${content}\nAgent:`,
      ].filter(Boolean).join('\n')

      const aiOptions = await resolveAiOptions(agent)
      const ai = await bridge.ai.generate('chat', prompt, undefined, aiOptions)

      const reply = ai.output.startsWith('[Dev mode]')
        ? `[Offline] Start the full Tauri app to enable AI responses from ${agent.name}.`
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
      notifyError(`${agent.name} encountered an error`, new Error(userMsg))
      pushMsg({ id: generateId(), role: 'assistant', content: `Error: ${userMsg}`, ts: Date.now() })
    } finally {
      set({ thinkingAgentIds: get().thinkingAgentIds.filter((x) => x !== agentId) })
    }
  },

  confirmRun: async (agentId, msgId) => {
    // Mark the card as confirmed immediately so the UI updates.
    const patch = (status: 'confirmed' | 'dismissed'): void => {
      const chat = { ...get().chatHistory }
      chat[agentId] = (chat[agentId] ?? []).map((m) =>
        m.id === msgId && m.pendingAction
          ? { ...m, pendingAction: { ...m.pendingAction, status } }
          : m,
      )
      writeChat(chat)
      set({ chatHistory: chat })
    }
    patch('confirmed')
    await get().runAgent(agentId)
  },

  dismissRun: (agentId, msgId) => {
    const chat = { ...get().chatHistory }
    chat[agentId] = (chat[agentId] ?? []).map((m) =>
      m.id === msgId && m.pendingAction
        ? { ...m, pendingAction: { ...m.pendingAction, status: 'dismissed' } }
        : m,
    )
    writeChat(chat)
    set({ chatHistory: chat })
  },

  clearChat: (agentId) => {
    const chat = { ...get().chatHistory, [agentId]: [] as IChatMessage[] }
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

  loadRuns: async (agentId) => {
    const agent = get().agents.find((b) => b.id === agentId)
    const localAll = readRuns()
    const localRuns = localAll[agentId] ?? []

    if (!agent?.synced || !tokenStore.getToken()) {
      set({ runs: { ...get().runs, [agentId]: localRuns } })
      return
    }

    try {
      const cloud = await cloudAgentsApi.getRuns(agentId)
      const converted: IDesktopAgentRun[] = cloud.map((r) => ({
        id: r.id,
        agent_id: r.agent_id,
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

      const updated = { ...get().runs, [agentId]: merged }
      writeRuns(updated)
      set({ runs: updated })
    } catch {
      // Network failure — show cached local runs.
      set({ runs: { ...get().runs, [agentId]: localRuns } })
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

  clearAgentMemory: async (agentId) => {
    if (!IS_TAURI) return
    try {
      const entries = await LM.memoryList({ scope: agentScope(agentId) })
      await Promise.all(entries.map((e) => LM.memoryDelete(e.id)))
    } catch (err) {
      notifyError('Failed to clear agent memory', err)
    }
  },

  buildAgentMemoryContext: async (agentId) => {
    if (!IS_TAURI) return ''
    try {
      return await LM.memoryBuildContext({ scope: agentScope(agentId) })
    } catch {
      return ''
    }
  },

  stopAgent: (id) => {
    // Immediately unblock the running lock so the UI responds.
    set({ runningAgentIds: get().runningAgentIds.filter((x) => x !== id) })
    // Set status to paused so agent rejects all future runAgent / sendMessage calls.
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
    set({ selectedAgentId: id })
    if (id !== null) void get().loadRuns(id)
  },

  clearError: () => { set({ error: null }) },
}))
