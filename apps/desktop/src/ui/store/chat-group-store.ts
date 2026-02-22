/**
 * chat-group-store.ts
 *
 * Group-chat store — a single shared conversation that routes messages across
 * ALL bots.  Architecture:
 *
 *  1. User types in the chat bar.
 *  2. `routeMessage()` on the BotRouter picks the best-fit bot (or falls back
 *     to a generic AI response).
 *  3. If the message implies an executable task, the chosen bot posts a
 *     PlanCard message (pendingPlan) so the user can review and confirm.
 *  4. On "Confirm", `executePlan()` runs the bot's task and posts the result
 *     back into the group thread.
 *  5. Any bot can answer a follow-up question about its own task ownership —
 *     the router tracks which bot "owns" which task by topic label.
 */

import { create } from 'zustand'
import { getDesktopBridge } from '../lib/bridge.js'
import { useAgentsStore, type IDesktopAgent } from './agents-store.js'
import { getDefaultKeyId, listAPIKeys } from '../../sdk/api-key-store.js'
import { useAppStore } from './app-store.js'
import { addLog } from './log-store.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GroupMsgRole = 'user' | 'bot' | 'system'

/** A step shown inside a plan card. */
export interface IPlanStep {
  label: string
  done: boolean
}

/**
 * A pending plan card attached to a bot message.
 * The user can confirm or dismiss it.
 */
export interface IPendingPlan {
  /** Unique plan id (same as the message id that carries it). */
  id: string
  /** The bot that owns and will execute this plan. */
  botId: string
  botName: string
  /** Short summary title shown at the top of the card. */
  title: string
  /** Ordered list of steps the bot plans to execute. */
  steps: IPlanStep[]
  /** 'pending' → user has not yet acted; 'confirmed' → running; 'dismissed' → skipped; 'done' → finished */
  status: 'pending' | 'confirmed' | 'dismissed' | 'done'
  /** Final result after execution (populated after status = 'done'). */
  result?: string
}

/** A single message in the group thread. */
export interface IGroupMessage {
  id: string
  role: GroupMsgRole
  /** The bot that produced this message (undefined for user / system messages). */
  botId?: string
  botName?: string
  /** Bot avatar emoji or first-letter shorthand. */
  botAvatar?: string
  content: string
  ts: number
  /** When present this message contains an embedded plan proposal card. */
  plan?: IPendingPlan
  /** True while an AI response is still being assembled. */
  isStreaming?: boolean
}

/** Per-bot task ownership registry — botId → topic label. */
type TaskOwnership = Record<string, string>

interface IGroupChatState {
  messages: IGroupMessage[]
  /** Set of botIds that are currently generating a reply. */
  thinkingBotIds: Set<string>
  /** Set of botIds that are currently executing a confirmed plan. */
  runningBotIds: Set<string>
  /** Maps botId → task topic label for follow-up routing. */
  taskOwnership: TaskOwnership
  error: string | null

  /** Send a user message and let the router handle it. */
  send(text: string): Promise<void>
  /** Confirm a plan card and execute the task. */
  confirmPlan(planId: string): Promise<void>
  /** Dismiss a plan card without executing. */
  dismissPlan(planId: string): void
  /** Clear the entire thread. */
  clear(): void
  setError(e: string | null): void
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'agenthub-group-chat-v1'

function persist(msgs: IGroupMessage[]): void {
  try {
    // Keep at most 200 messages in storage; drop plans' streaming state.
    const clean = msgs.slice(-200).map((m) => ({ ...m, isStreaming: false }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
  } catch { /* storage full — ignore */ }
}

function hydrate(): IGroupMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as IGroupMessage[]
    // Re-hydrate timestamps as numbers (JSON serialises them as numbers already).
    return parsed
  } catch { return [] }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _msgCounter = 0
function uid(): string {
  return `gc-${Date.now().toString(36)}-${String(++_msgCounter)}`
}

/** Resolve BYOK defaults from the global api-key-store. */
async function resolveApiOptions(): Promise<{ apiKey?: string; provider?: string; model?: string }> {
  try {
    const defaultId: string | null = await getDefaultKeyId()
    if (!defaultId) return {}
    const keys = await listAPIKeys()
    const entry = keys.find((k) => k.id === defaultId && k.isActive)
    if (!entry) return {}
    const opts: { apiKey?: string; provider?: string; model?: string } = { apiKey: entry.rawKey, provider: entry.provider }
    if (entry.model) opts.model = entry.model
    return opts
  } catch { return {} }
}

function botAvatar(bot: IDesktopAgent): string {
  return bot.name.charAt(0).toUpperCase()
}

function notifyError(title: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  useAppStore.getState().pushNotification({ level: 'error', title, body: msg })
}

// ─── Bot routing ──────────────────────────────────────────────────────────────

/** Patterns that strongly suggest the user is asking about an in-progress task. */
const STATUS_PATTERN = /\b(finished|done|completed|ready|progress|status|complete|yet|still|running)\b/i

// ─── AI-powered bot router ────────────────────────────────────────────────────

/** Result returned by the AI router. */
interface IRouterDecision {
  /** ID of the chosen bot, or null → fall back to generic AI. */
  botId: string | null
  /** 'action' → propose a plan card; 'conversational' → reply directly. */
  intent: 'action' | 'conversational'
}

/**
 * Ask the AI to decide:
 *   1. Which bot (by id) best fits the user's message.
 *   2. Whether the message is an executable task or a conversational reply.
 *
 * The model receives a compact bot roster and must respond with a single JSON
 * object — nothing else.  Falls back to keyword heuristics on any failure.
 */
async function aiPickBot(
  text: string,
  agents: IDesktopAgent[],
): Promise<IRouterDecision> {
  const active = agents.filter((b) => b.status === 'active')
  if (active.length === 0) return { botId: null, intent: 'conversational' }

  const botList = active
    .map((b) => `- id: "${b.id}", name: "${b.name}", purpose: "${b.description}"`)
    .join('\n')

  const prompt =
    `You are a bot router. Respond with ONLY one line of JSON — no markdown, no explanation.\n\n` +
    `Available bots:\n${botList}\n\n` +
    `User message: "${text.replace(/"/g, "'")}"\n\n` +
    `Rules:\n` +
    `- "botId": the id of the bot whose purpose best fits the message, or null if none fits well.\n` +
    `- "intent": "action" when the user wants something DONE (run, create, analyze, write, fix, deploy, fetch, generate, etc.), ` +
    `"conversational" for questions or chat.\n\n` +
    `Respond with exactly: {"botId": "<id or null>", "intent": "<action or conversational>"}`

  try {
    const bridge = getDesktopBridge()
    const aiOptions = await resolveApiOptions()
    const res = await bridge.ai.generate(
      'chat',
      prompt,
      undefined,
      Object.keys(aiOptions).length > 0 ? aiOptions : undefined,
    )

    // Strip any accidental markdown fences then parse the JSON object.
    const match = res.output.match(/\{[\s\S]*?\}/)
    if (!match) throw new Error('Router returned no JSON')

    const parsed = JSON.parse(match[0]) as { botId?: string | null; intent?: string }
    const chosenId = typeof parsed.botId === 'string' ? parsed.botId : null
    const chosenBot = chosenId ? active.find((b) => b.id === chosenId) : null

    addLog({
      level: 'info',
      source: 'router',
      message: `AI routed → bot: ${chosenBot?.name ?? 'none'}, intent: ${parsed.intent ?? '?'}`,
      detail: text.length > 120 ? `${text.slice(0, 120)}…` : text,
    })

    return {
      botId: chosenBot?.id ?? null,
      intent: parsed.intent === 'action' ? 'action' : 'conversational',
    }
  } catch {
    // AI unavailable or parse error — fall back silently to keyword heuristics.
    addLog({ level: 'warn', source: 'router', message: 'AI router failed — using keyword fallback' })
    return _keywordFallback(text, active)
  }
}

// ─── Keyword fallback (used when the AI router is unavailable) ─────────────────

const _ACTION_KW = [
  'run', 'execute', 'do', 'start', 'check', 'analyze', 'analyse', 'search',
  'generate', 'create', 'write', 'fetch', 'monitor', 'scan', 'review',
  'update', 'send', 'find', 'get', 'make', 'build', 'show me', 'give me',
  'tell me', 'report', 'summarize', 'summarise', 'compute', 'calculate',
  'track', 'watch', 'go ahead', 'proceed', 'document', 'list', 'export',
  'deploy', 'test', 'fix', 'debug', 'refactor', 'migrate', 'install',
]
const _INFO_PATTERN = /^(what is|what's|who is|who's|why |when |how does|how do|explain|describe|is it|are you|can you|could you tell)/i

function _scoreBotMatch(bot: IDesktopAgent, text: string): number {
  const lower = text.toLowerCase()
  const desc  = bot.description.toLowerCase()
  const name  = bot.name.toLowerCase()
  const userWords = lower.split(/\W+/).filter((w) => w.length >= 4)
  const descWords = desc.split(/\W+/).filter((w) => w.length >= 4)
  const nameWords = name.split(/\W+/).filter((w) => w.length >= 3)
  let hits = 0
  for (const uw of userWords) {
    if (descWords.some((dw) => dw.includes(uw) || uw.includes(dw))) hits += 1
    if (nameWords.some((nw) => nw.includes(uw) || uw.includes(nw))) hits += 1.5
  }
  return Math.min(hits / Math.max(userWords.length * 2.5, 1), 1)
}

function _keywordFallback(text: string, active: IDesktopAgent[]): IRouterDecision {
  const lower = text.toLowerCase()
  const isAction = !_INFO_PATTERN.test(lower) && _ACTION_KW.some((w) => lower.includes(w))
  let best: IDesktopAgent | undefined
  let bestScore = 0
  for (const b of active) {
    const s = _scoreBotMatch(b, text)
    if (s > bestScore) { bestScore = s; best = b }
  }
  const chosen = bestScore >= 0.1 ? best : active[0]
  return { botId: chosen?.id ?? null, intent: isAction ? 'action' : 'conversational' }
}

/**
 * Check whether the user is asking a status/follow-up question about a task
 * already owned by one of the bots.
 * Returns the owning bot, or undefined.
 */
function findOwnerBot(
  text: string,
  ownership: TaskOwnership,
  agents: IDesktopAgent[],
): IDesktopAgent | undefined {
  if (!STATUS_PATTERN.test(text)) return undefined

  // Look for a bot whose owned topic has keywords that appear in the message.
  const lower = text.toLowerCase()
  for (const [botId, topic] of Object.entries(ownership)) {
    const topicWords = topic.toLowerCase().split(/\W+/).filter((w) => w.length >= 4)
    if (topicWords.some((tw) => lower.includes(tw))) {
      return agents.find((b) => b.id === botId)
    }
  }
  return undefined
}

/**
 * Build the planned steps for a task based on the bot's templateId.
 */
const TEMPLATE_STEPS: Record<string, string[]> = {
  'daily-digest':          ['Fetch top headlines', 'Parse article content', 'Summarise each story', 'Format digest', 'Save output'],
  'research-assistant':    ['Parse research query', 'Search knowledge sources', 'Extract key facts', 'Synthesise findings', 'Format report'],
  'price-alert':           ['Connect to market feed', 'Fetch current price', 'Compare with 24h baseline', 'Evaluate alert threshold', 'Generate price report'],
  'crypto-analysis':       ['Connect to market feed', 'Fetch multi-asset data', 'Run technical analysis', 'Generate AI market outlook', 'Save analysis'],
  'code-reviewer':         ['Read latest git diff', 'Parse code changes', 'Detect issues & smells', 'Generate suggestions', 'Format review'],
  'meeting-notes':         ['Read transcript', 'Identify speakers', 'Extract action items', 'Summarise discussion', 'Save notes'],
  'writing-helper':        ['Parse input text', 'Detect language & tone', 'Apply transformation', 'Review result quality', 'Save output'],
  'release-notes-writer':  ['Parse git log since last tag', 'Group commits by type', 'Draft release notes', 'Polish language', 'Save release notes'],
  'bug-triage':            ['Load open issues', 'Classify by severity', 'Suggest owners', 'Generate triage report', 'Save report'],
}
const DEFAULT_STEPS = ['Initialise task', 'Process request', 'Execute with AI', 'Review output', 'Complete & save']

function buildPlanSteps(bot: IDesktopAgent): string[] {
  return TEMPLATE_STEPS[bot.templateId ?? ''] ?? DEFAULT_STEPS
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGroupChatStore = create<IGroupChatState>((set, get) => ({
  messages: hydrate(),
  thinkingBotIds: new Set(),
  runningBotIds: new Set(),
  taskOwnership: {},
  error: null,

  send: async (text: string) => {
    if (!text.trim()) return
    if (get().thinkingBotIds.size > 0) return  // debounce while any bot is thinking

    const userMsg: IGroupMessage = {
      id: uid(),
      role: 'user',
      content: text.trim(),
      ts: Date.now(),
    }
    const next = [...get().messages, userMsg]
    persist(next)
    set({ messages: next, error: null })

    const { agents } = useAgentsStore.getState()

    // ── Status query: check if an agent already owns this topic ───────────────
    const ownerBot = findOwnerBot(text, get().taskOwnership, agents)
    if (ownerBot) {
      await _botStatusReply(ownerBot, text, get, set)
      return
    }

    // ── AI-powered routing: decide which agent + action vs conversation ───────
    const decision = await aiPickBot(text, agents)
    const chosenBot = decision.botId ? agents.find((b) => b.id === decision.botId) : undefined

    if (decision.intent === 'action') {
      if (!chosenBot) {
        _postSystem(set, get, '⚠️ No active bots available. Create a bot in the **Bots** tab first.')
        return
      }
      await _botProposePlan(chosenBot, text, get, set)
      return
    }

    // Conversational — chosen bot replies directly, or fall back to generic AI.
    if (!chosenBot) {
      await _genericAiReply(text, get, set)
      return
    }
    await _botConversationalReply(chosenBot, text, get, set)
  },

  confirmPlan: async (planId: string) => {
    // Find the message that carries this plan.
    const msgs = get().messages
    const msgIdx = msgs.findIndex((m) => m.plan?.id === planId)
    if (msgIdx === -1) return
    const msgData = msgs[msgIdx]
    if (!msgData) return
    const plan = msgData.plan!
    if (plan.status !== 'pending') return

    // Update plan status → confirmed.
    const _patch = (update: Partial<IPendingPlan>): void => {
      const updated = get().messages.map((m) =>
        m.plan?.id === planId
          ? { ...m, plan: { ...m.plan!, ...update } }
          : m,
      )
      persist(updated)
      set({ messages: updated })
    }
    _patch({ status: 'confirmed' })

    // Mark bot as running.
    const running = new Set(get().runningBotIds)
    running.add(plan.botId)
    set({ runningBotIds: running })

    // Register task ownership so follow-up questions route back here.
    set({ taskOwnership: { ...get().taskOwnership, [plan.botId]: plan.title } })

    const { agents } = useAgentsStore.getState()
    const bot = agents.find((b) => b.id === plan.botId)

    try {
      // Animate each step as done.
      const stepCount = plan.steps.length
      for (let i = 0; i < stepCount; i++) {
        await _sleep(600 + Math.random() * 600)
        _patch({
          steps: plan.steps.map((s, idx) => ({ ...s, done: idx <= i })),
        })
      }

      // Perform the actual AI call.
      const bridge = getDesktopBridge()
      const aiOptions = await _botAiOptions(bot)
      const taskPrompt = `You are "${bot?.name ?? 'AI'}", a focused AI agent.\nYour purpose: ${bot?.description ?? plan.title}\n\nTask: ${plan.title}\n\nComplete the task and provide a concise but thorough result.`

      addLog({ level: 'info', source: 'group-chat', message: `Executing plan: ${plan.title}`, detail: `Bot: ${bot?.name ?? plan.botId}` })

      const ai = await bridge.ai.generate('chat', taskPrompt, undefined, aiOptions)
      const result = ai.output.startsWith('[Dev mode]')
        ? `[Offline] Start the full Tauri app to enable real AI execution for: ${plan.title}`
        : ai.output

      _patch({ status: 'done', result, steps: plan.steps.map((s) => ({ ...s, done: true })) })

      // Post a follow-up message from the bot with the result.
      const resultMsg: IGroupMessage = {
        id: uid(),
        role: 'bot',
        botId: plan.botId,
        botName: plan.steps[0] ? (bot?.name ?? 'Bot') : 'Bot',
        botAvatar: bot ? botAvatar(bot) : '🤖',
        content: `✅ **${plan.title}** — completed!\n\n${result.length > 800 ? `${result.slice(0, 800)}…` : result}`,
        ts: Date.now(),
      }
      const updated2 = [...get().messages, resultMsg]
      persist(updated2)
      set({ messages: updated2 })

      addLog({ level: 'info', source: 'group-chat', message: `Plan completed: ${plan.title}` })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      notifyError(`${bot?.name ?? 'Bot'} — task failed`, err)
      _patch({ status: 'done', result: `Error: ${errMsg}`, steps: plan.steps.map((s) => ({ ...s, done: false })) })
      addLog({ level: 'error', source: 'group-chat', message: `Plan failed: ${plan.title}`, detail: errMsg })
    } finally {
      const r = new Set(get().runningBotIds)
      r.delete(plan.botId)
      set({ runningBotIds: r })
    }
  },

  dismissPlan: (planId: string) => {
    const updated = get().messages.map((m) =>
      m.plan?.id === planId
        ? { ...m, plan: { ...m.plan!, status: 'dismissed' as const } }
        : m,
    )
    persist(updated)
    set({ messages: updated })
    _postSystem(set, get, 'Plan dismissed. Let me know if you change your mind.')
  },

  clear: () => {
    persist([])
    set({ messages: [], error: null, taskOwnership: {} })
  },

  setError: (error) => { set({ error }) },
}))

// ─── Internal helpers ─────────────────────────────────────────────────────────

type SetFn = Parameters<typeof useGroupChatStore['setState']>[0]
type GetFn = () => IGroupChatState

const _sleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms) })

function _postSystem(
  set: (partial: Partial<IGroupChatState> | ((s: IGroupChatState) => Partial<IGroupChatState>)) => void,
  get: GetFn,
  content: string,
): void {
  const msg: IGroupMessage = { id: uid(), role: 'system', content, ts: Date.now() }
  const next = [...get().messages, msg]
  persist(next)
  set({ messages: next })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _postBotMsg(
  set: (partial: Partial<IGroupChatState> | ((s: IGroupChatState) => Partial<IGroupChatState>)) => void,
  get: GetFn,
  bot: IDesktopAgent,
  content: string,
  extra?: Partial<IGroupMessage>,
): void {
  const msg: IGroupMessage = {
    id: uid(),
    role: 'bot',
    botId: bot.id,
    botName: bot.name,
    botAvatar: botAvatar(bot),
    content,
    ts: Date.now(),
    ...extra,
  }
  const next = [...get().messages, msg]
  persist(next)
  set({ messages: next })
}

async function _botAiOptions(bot: IDesktopAgent | undefined): Promise<{ apiKey?: string; provider?: string; model?: string } | undefined> {
  if (bot?.apiKey) {
    return { apiKey: bot.apiKey, ...(bot.aiProvider ? { provider: bot.aiProvider } : {}) }
  }
  const global = await resolveApiOptions()
  return Object.keys(global).length > 0 ? global : undefined
}

/** Let a bot propose a plan card for an action-intent message. */
async function _botProposePlan(
  bot: IDesktopAgent,
  userText: string,
  get: GetFn,
  set: (partial: Partial<IGroupChatState> | ((s: IGroupChatState) => Partial<IGroupChatState>)) => void,
): Promise<void> {
  const thinking = new Set(get().thinkingBotIds)
  thinking.add(bot.id)
  set({ thinkingBotIds: thinking })

  await _sleep(600)

  const planId = uid()
  const steps = buildPlanSteps(bot).map((label) => ({ label, done: false }))

  // Derive a short task title from the user message (first 80 chars, title-cased).
  const rawTitle = userText.trim()
  const title = rawTitle.length > 80 ? `${rawTitle.slice(0, 80)}…` : rawTitle

  const plan: IPendingPlan = {
    id: planId,
    botId: bot.id,
    botName: bot.name,
    title,
    steps,
    status: 'pending',
  }

  const proposalMsg: IGroupMessage = {
    id: planId,
    role: 'bot',
    botId: bot.id,
    botName: bot.name,
    botAvatar: botAvatar(bot),
    content: `I can take care of that! Here's my plan:`,
    ts: Date.now(),
    plan,
  }

  const next = [...get().messages, proposalMsg]
  persist(next)

  const t2 = new Set(get().thinkingBotIds)
  t2.delete(bot.id)
  set({ messages: next, thinkingBotIds: t2 })
}

/** Let a bot answer a conversational (non-action) message. */
async function _botConversationalReply(
  bot: IDesktopAgent,
  userText: string,
  get: GetFn,
  set: (partial: Partial<IGroupChatState> | ((s: IGroupChatState) => Partial<IGroupChatState>)) => void,
): Promise<void> {
  const thinking = new Set(get().thinkingBotIds)
  thinking.add(bot.id)
  set({ thinkingBotIds: thinking })

  // Insert streaming placeholder.
  const streamId = uid()
  const placeholder: IGroupMessage = {
    id: streamId,
    role: 'bot',
    botId: bot.id,
    botName: bot.name,
    botAvatar: botAvatar(bot),
    content: '',
    ts: Date.now(),
    isStreaming: true,
  }
  const withPlaceholder = [...get().messages, placeholder]
  persist(withPlaceholder)
  set({ messages: withPlaceholder })

  try {
    const bridge = getDesktopBridge()
    const aiOptions = await _botAiOptions(bot)

    const recentMsgs = get().messages.slice(-6, -1)
    const context = recentMsgs
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role === 'user' ? 'User' : m.botName ?? 'Bot'}: ${m.content.slice(0, 200)}`)
      .join('\n')

    const prompt = [
      `You are "${bot.name}", a focused AI agent in a group workspace chat.`,
      `Your purpose: ${bot.description}`,
      context ? `\nRecent conversation:\n${context}` : null,
      `\nUser: ${userText}\n${bot.name}:`,
    ].filter(Boolean).join('\n')

    let accumulated = ''
    const unsub = bridge.chat.onStream((chunk) => {
      accumulated += chunk
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === streamId ? { ...m, content: accumulated } : m,
        ),
      }))
    })

    const res = await bridge.chat.send(prompt, aiOptions ?? {})
    unsub()
    const final = (accumulated || res.output).startsWith('[Dev mode]')
      ? `[Offline] Start the full Tauri app to enable AI responses from ${bot.name}.`
      : accumulated || res.output

    const finished = get().messages.map((m) =>
      m.id === streamId ? { ...m, content: final, isStreaming: false } : m,
    )
    persist(finished)
    set({ messages: finished })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    notifyError(`${bot.name} — reply failed`, err)
    const errMsgs = get().messages.map((m) =>
      m.id === streamId ? { ...m, content: `Error: ${msg}`, isStreaming: false } : m,
    )
    persist(errMsgs)
    set({ messages: errMsgs })
  } finally {
    const t2 = new Set(get().thinkingBotIds)
    t2.delete(bot.id)
    set({ thinkingBotIds: t2 })
  }
}

/** Let the task-owner bot answer a status follow-up question. */
async function _botStatusReply(
  bot: IDesktopAgent,
  userText: string,
  get: GetFn,
  set: (partial: Partial<IGroupChatState> | ((s: IGroupChatState) => Partial<IGroupChatState>)) => void,
): Promise<void> {
  const thinking = new Set(get().thinkingBotIds)
  thinking.add(bot.id)
  set({ thinkingBotIds: thinking })

  const streamId = uid()
  const placeholder: IGroupMessage = {
    id: streamId,
    role: 'bot',
    botId: bot.id,
    botName: bot.name,
    botAvatar: botAvatar(bot),
    content: '',
    ts: Date.now(),
    isStreaming: true,
  }
  const withPlaceholder = [...get().messages, placeholder]
  persist(withPlaceholder)
  set({ messages: withPlaceholder })

  try {
    const bridge = getDesktopBridge()
    const aiOptions = await _botAiOptions(bot)

    const ownedTopic = get().taskOwnership[bot.id] ?? 'your assigned task'
    const relatedPlan = [...get().messages].reverse().find(
      (m) => m.plan?.botId === bot.id && (m.plan.status === 'confirmed' || m.plan.status === 'done'),
    )
    const planStatus = relatedPlan?.plan?.status ?? 'unknown'
    const planResult = relatedPlan?.plan?.result

    const context = planResult
      ? `You previously completed the task "${ownedTopic}". Result: ${planResult.slice(0, 400)}`
      : planStatus === 'confirmed'
        ? `You are currently executing the task "${ownedTopic}".`
        : `You have been assigned the task "${ownedTopic}" but it has not started yet.`

    const prompt = [
      `You are "${bot.name}", a focused AI agent in a group workspace chat.`,
      `Your purpose: ${bot.description}`,
      context,
      `\nUser is asking: ${userText}`,
      `\nRespond with a clear, concise status update. ${bot.name}:`,
    ].join('\n')

    let accumulated = ''
    const unsub = bridge.chat.onStream((chunk) => {
      accumulated += chunk
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === streamId ? { ...m, content: accumulated } : m,
        ),
      }))
    })

    const res = await bridge.chat.send(prompt, aiOptions ?? {})
    unsub()
    const final = (accumulated || res.output).startsWith('[Dev mode]')
      ? `[Offline] I was assigned "${ownedTopic}". Status: ${planStatus}.`
      : accumulated || res.output

    const finished = get().messages.map((m) =>
      m.id === streamId ? { ...m, content: final, isStreaming: false } : m,
    )
    persist(finished)
    set({ messages: finished })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    notifyError(`${bot.name} — status reply failed`, err)
    const errMsgs = get().messages.map((m) =>
      m.id === streamId ? { ...m, content: `Error: ${msg}`, isStreaming: false } : m,
    )
    persist(errMsgs)
    set({ messages: errMsgs })
  } finally {
    const t2 = new Set(get().thinkingBotIds)
    t2.delete(bot.id)
    set({ thinkingBotIds: t2 })
  }
}

/** Fallback: generic AI reply when no bots are available. */
async function _genericAiReply(
  userText: string,
  get: GetFn,
  set: (partial: Partial<IGroupChatState> | ((s: IGroupChatState) => Partial<IGroupChatState>)) => void,
): Promise<void> {
  const streamId = uid()
  const placeholder: IGroupMessage = {
    id: streamId,
    role: 'bot',
    botName: 'AI Assistant',
    botAvatar: '✦',
    content: '',
    ts: Date.now(),
    isStreaming: true,
  }
  const withPlaceholder = [...get().messages, placeholder]
  persist(withPlaceholder)
  set({ messages: withPlaceholder })

  try {
    const bridge = getDesktopBridge()
    const aiOptions = await resolveApiOptions()

    let accumulated = ''
    const unsub = bridge.chat.onStream((chunk) => {
      accumulated += chunk
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === streamId ? { ...m, content: accumulated } : m,
        ),
      }))
    })

    const res = await bridge.chat.send(userText, Object.keys(aiOptions).length > 0 ? aiOptions : {})
    unsub()
    const final = accumulated || res.output

    const finished = get().messages.map((m) =>
      m.id === streamId ? { ...m, content: final, isStreaming: false } : m,
    )
    persist(finished)
    set({ messages: finished })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const errMsgs = get().messages.map((m) =>
      m.id === streamId ? { ...m, content: `Error: ${msg}`, isStreaming: false } : m,
    )
    persist(errMsgs)
    set({ messages: errMsgs })
  }
}

// Suppress unused-variable warnings for SetFn type alias (used implicitly above).
void (undefined as unknown as SetFn)
