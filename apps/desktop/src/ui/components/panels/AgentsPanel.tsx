/**
 * AgentsPanel.tsx
 *
 * Bot detail panel with three tabs:
 *   - Custom UI  - rich per-template/category widget (hidden for bots with no template)
 *   - Detail     - goal editing, run CTA, latest output, chat, run history
 *   - Settings   - name, description, status, danger zone
 */

import React, { useEffect, useRef, useState } from 'react'
import { useAgentsStore, type IDesktopAgent, type IDesktopAgentRun, type IChatMessage, type IAgentCredential } from '../../store/agents-store.js'
import { useAppStore } from '../../store/app-store.js'
import {
  findTemplate,
  type IAgentTemplate,
} from '../../store/agent-templates.js'
import { CryptoPanel } from '../modules/CryptoPanel.js'
import { WritingHelperPanel } from '../modules/WritingHelperPanel.js'

/** Map module id → its embedded interactive panel (maintained alongside BUILTIN_MODULES). */
const MODULE_PANELS: Record<string, React.JSX.Element> = {
  'crypto':         <CryptoPanel embedded />,
  'writing-helper': <WritingHelperPanel embedded />,
}

// ─── Tab type ──────────────────────────────────────────────────────────────────

type AgentTab = 'chat' | 'custom' | 'settings'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${String(Math.floor(ms / 60_000))}m ago`
  if (ms < 86_400_000) return `${String(Math.floor(ms / 3_600_000))}h ago`
  return new Date(iso).toLocaleDateString()
}

function formatDuration(start: string, end?: string): string {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1_000) return `${String(ms)}ms`
  if (ms < 60_000) return `${String(Math.round(ms / 1_000))}s`
  return `${String(Math.floor(ms / 60_000))}m ${String(Math.round((ms % 60_000) / 1_000))}s`
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  pending:   'bg-yellow-400',
  running:   'animate-pulse bg-blue-400',
  completed: 'bg-[var(--color-success)]',
  failed:    'bg-[var(--color-danger)]',
  cancelled: 'bg-[var(--color-text-muted)]',
}

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-yellow-400/15 text-yellow-400',
  running:   'bg-blue-400/15 text-blue-400',
  completed: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  failed:    'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
  cancelled: 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]',
}

const ACTIVE_STATUSES = new Set(['pending', 'running'])

// ─── Run history item ─────────────────────────────────────────────────────────

function RunItem({ run }: { run: IDesktopAgentRun }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center gap-3">
        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[run.status] ?? ''}`} />
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[run.status] ?? ''}`}>
          {run.status}
        </span>
        {run.steps > 0 && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {String(run.steps)} step{run.steps !== 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
          {relativeTime(run.started_at)} · {formatDuration(run.started_at, run.ended_at)}
        </span>
        {run.result && (
          <button
            onClick={() => { setExpanded((v) => !v) }}
            className="ml-1 text-[10px] text-[var(--color-accent)] hover:underline"
          >
            {expanded ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {expanded && run.result && (
        <p className="mt-2 whitespace-pre-wrap pl-5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          {run.result}
        </p>
      )}
    </div>
  )
}

// ─── Live run progress panel ──────────────────────────────────────────────────

/**
 * Shows an animated step-by-step progress panel while a bot run is executing.
 * Subscribes directly to the store so it re-renders on every `patchRuns` call.
 */
function RunProgress({ botId, runId }: { botId: string; runId: string }): React.JSX.Element {
  const runs   = useAgentsStore((s) => s.runs)
  const run    = (runs[botId] ?? []).find((r) => r.id === runId)
  const planned = run?.plannedSteps ?? ['Running…']
  const logs    = run?.logs ?? []

  return (
    <div className="overflow-hidden rounded-2xl border border-blue-400/20 bg-blue-400/5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-blue-400/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
          <p className="text-xs font-semibold text-blue-400 tracking-wide uppercase">Executing</p>
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          Step {String(Math.min(logs.length, planned.length))} of {String(planned.length)}
        </span>
      </div>
      {/* Step list */}
      <ol className="px-5 py-4 space-y-1">
        {planned.map((label, i) => {
          const isDone    = i < logs.length - 1
          const isCurrent = i === logs.length - 1
          const isPending = i >= logs.length
          return (
            <li key={i} className="flex items-center gap-3 py-1.5">
              {/* Step indicator */}
              <span
                className={[
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] transition-all duration-300',
                  isDone    ? 'bg-[var(--color-success)] text-white'       : '',
                  isCurrent ? 'border-2 border-blue-400'                   : '',
                  isPending ? 'border border-[var(--color-border)]'        : '',
                ].join(' ')}
              >
                {isDone && '✓'}
                {isCurrent && (
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-blue-400 border-t-transparent" />
                )}
              </span>
              {/* Step label */}
              <span
                className={`flex-1 text-sm transition-colors duration-300 ${
                  isPending
                    ? 'text-[var(--color-text-muted)]'
                    : 'text-[var(--color-text-primary)]'
                }`}
              >
                {label}
              </span>
              {/* Status tag */}
              {isDone    && <span className="text-[10px] text-[var(--color-success)]">done</span>}
              {isCurrent && <span className="text-[10px] text-blue-400 font-medium">running</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ─── Run history section (collapsed by default) ───────────────────────────────

function RunHistorySection({ botRuns, botId }: { botRuns: IDesktopAgentRun[]; botId: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <section>
      <button
        onClick={() => { setOpen((v) => !v) }}
        className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <span className="text-[8px]">{open ? '▾' : '▸'}</span>
        Run History
        <span className="ml-1 rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5">{String(botRuns.length)}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {botRuns.map((run) => <RunItem key={run.id} run={run} />)}
          <button
            onClick={() => { void useAgentsStore.getState().loadRuns(botId) }}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Refresh
          </button>
        </div>
      )}
    </section>
  )
}

// ─── Chat tab ─────────────────────────────────────────────────────────────────

// Stable empty array — a new `[]` literal on every selector call causes
// useSyncExternalStore to see a different reference every tick → infinite loop.
const EMPTY_CHAT: IChatMessage[] = []

/**
 * ChatTabErrorBoundary — catches render/effect errors in ChatTab so a single
 * bot crash cannot take down the whole app.
 */
class ChatTabErrorBoundary extends React.Component<
  { botName: string; children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { botName: string; children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(err: unknown): { hasError: boolean; message: string } {
    const message = err instanceof Error ? err.message : String(err)
    return { hasError: true, message }
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-6 py-10 text-center">
          <p className="text-2xl">⚠️</p>
          <p className="text-sm font-semibold text-[var(--color-danger)]">
            {this.props.botName} encountered an error
          </p>
          <p className="max-w-xs text-xs text-[var(--color-text-muted)]">{this.state.message}</p>
          <button
            onClick={() => { this.setState({ hasError: false, message: '' }) }}
            className="mt-2 rounded-lg bg-[var(--color-surface-2)] px-4 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

interface IChatTabProps {
  bot: IDesktopAgent
  botRuns: IDesktopAgentRun[]
}

function ChatTab({ bot, botRuns }: IChatTabProps): React.JSX.Element {
  const messages   = useAgentsStore((s) => s.chatHistory[bot.id] ?? EMPTY_CHAT)
  const isThinking = useAgentsStore((s) => s.thinkingBotIds.includes(bot.id))
  const error      = useAgentsStore((s) => s.error)
  const [input, setInput] = useState('')
  const bottomRef         = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isThinking])

  const handleSend = (): void => {
    const text = input.trim()
    if (!text || isThinking) return
    setInput('')
    void useAgentsStore.getState().sendMessage(bot.id, text)
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          <span>{error}</span>
          <button onClick={() => { useAgentsStore.getState().clearError() }} className="ml-4 text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Status strip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${
            bot.status === 'active' ? 'animate-pulse bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'
          }`} />
          <span className="text-xs text-[var(--color-text-muted)]">
            {bot.status === 'active' ? 'Online · waiting for commands' : 'Paused · not responding'}
          </span>
        </div>
        <button
          onClick={() => { useAgentsStore.getState().clearChat(bot.id) }}
          className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          Clear
        </button>
      </div>

      {/* Messages + input */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {/* Message list */}
        <div className="min-h-[240px] max-h-[420px] overflow-y-auto space-y-3 px-5 py-5">
          {messages.length === 0 && (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <p className="text-3xl">{bot.status === 'active' ? '🤖' : '⏸'}</p>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {bot.status === 'active' ? `${bot.name} is online` : `${bot.name} is paused`}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {bot.status === 'active'
                    ? 'Type a message or ask me to do something.'
                    : 'Activate this bot in Settings to start chatting.'}
                </p>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${
              m.role === 'user' ? 'items-end' : 'items-start'
            } gap-1`}>
              <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                {m.role === 'assistant' && (
                  <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-xs">
                    {bot.templateId ? (findTemplate(bot.templateId)?.icon ?? '🤖') : '🤖'}
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)]'
                }`}>
                  {m.content}
                </div>
              </div>
              {/* Confirmation card — shown below the assistant message that proposed a run */}
              {m.pendingAction && (
                <div className="ml-8 mt-1 w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                  {m.pendingAction.status === 'pending' && (
                    <>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">⚡ Task to execute</p>
                      <p className="mb-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">{m.pendingAction.label}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { void useAgentsStore.getState().confirmRun(bot.id, m.id) }}
                          className="rounded-lg bg-[var(--color-success)] px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        >
                          ✅ Yes, run it
                        </button>
                        <button
                          onClick={() => { useAgentsStore.getState().dismissRun(bot.id, m.id) }}
                          className="rounded-lg border border-[var(--color-border)] px-4 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        >
                          ✕ Skip
                        </button>
                      </div>
                    </>
                  )}
                  {m.pendingAction.status === 'confirmed' && (
                    <p className="flex items-center gap-2 text-xs text-[var(--color-success)]">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-success)] border-t-transparent" />
                      Task confirmed — running…
                    </p>
                  )}
                  {m.pendingAction.status === 'dismissed' && (
                    <p className="text-xs text-[var(--color-text-muted)]">✕ Skipped</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {isThinking && (
            <div className="flex items-start gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-xs">
                {bot.templateId ? (findTemplate(bot.templateId)?.icon ?? '🤖') : '🤖'}
              </div>
              <div className="rounded-2xl bg-[var(--color-surface-2)] px-4 py-3">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)]"
                      style={{ animationDelay: `${String(i * 150)}ms` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-[var(--color-border)]">
          <div className="flex gap-2 px-4 py-3">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={bot.status === 'paused' ? `${bot.name} is paused…` : `Message ${bot.name}…`}
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-accent)]"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
            >
              ↑
            </button>
          </div>
        </div>
      </div>

      {/* Run history — collapsed by default */}
      {botRuns.length > 0 && <RunHistorySection botRuns={botRuns} botId={bot.id} />}
    </div>
  )
}

// ─── Custom UI tab ────────────────────────────────────────────────────────────

function CustomTabContent({ bot }: { bot: IDesktopAgent; latestRun?: IDesktopAgentRun | undefined }): React.JSX.Element | null {
  if (!bot.templateId) return null
  return MODULE_PANELS[bot.templateId] ?? null
}


// ─── Credential sub-components ───────────────────────────────────────────────

function CredentialRow({
  cred,
  onRemove,
}: {
  cred: IAgentCredential
  onRemove: () => void
}): React.JSX.Element {
  const [show, setShow] = useState(!cred.masked)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{cred.key}</p>
        <p className="mt-0.5 truncate font-mono text-xs text-[var(--color-text-primary)]">
          {show ? cred.value : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
        </p>
      </div>
      {cred.masked && (
        <button
          type="button"
          onClick={() => { setShow((v) => !v) }}
          className="shrink-0 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove credential ${cred.key}`}
        className="shrink-0 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-danger)]"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

function AddCredentialForm({ onAdd }: { onAdd: (cred: IAgentCredential) => void }): React.JSX.Element {
  const [key,     setKey]     = useState('')
  const [value,   setValue]   = useState('')
  const [masked,  setMasked]  = useState(false)
  const [showVal, setShowVal] = useState(true)

  const handleAdd = (): void => {
    const k = key.trim()
    const v = value.trim()
    if (!k || !v) return
    onAdd({ key: k, value: v, masked })
    setKey('')
    setValue('')
    setMasked(false)
    setShowVal(true)
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-[var(--color-border)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Add Credential</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={key}
          onChange={(e) => { setKey(e.target.value) }}
          placeholder="Name\u00a0(e.g.\u00a0email)"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
        />
        <div className="relative">
          <input
            type={showVal ? 'text' : 'password'}
            value={value}
            onChange={(e) => { setValue(e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Value"
            autoComplete="off"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 pr-14 text-xs text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
          />
          <button
            type="button"
            onClick={() => { setShowVal((v) => !v) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            {showVal ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={masked}
            onChange={(e) => { setMasked(e.target.checked); if (e.target.checked) setShowVal(false) }}
            className="rounded"
          />
          Mask as password
        </label>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!key.trim() || !value.trim()}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({ bot, template, colorClass, onDelete, isRunning, onStop }: {
  bot: IDesktopAgent
  template?: IAgentTemplate | undefined
  colorClass: string
  onDelete: () => void
  isRunning: boolean
  onStop: () => void
}): React.JSX.Element {
  const [name,      setName]      = useState(bot.name)
  const [desc,      setDesc]      = useState(bot.description)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  // API key override state
  const [apiKey,       setApiKey]       = useState(bot.apiKey ?? '')
  const [showKey,      setShowKey]      = useState(false)
  const [savingKey,    setSavingKey]    = useState(false)
  const [savedKey,     setSavedKey]     = useState(false)
  // AI provider override state
  const [aiProvider,   setAiProvider]   = useState(bot.aiProvider ?? '')
  const [savingProv,   setSavingProv]   = useState(false)
  const [savedProv,    setSavedProv]    = useState(false)
  // Credentials state
  const [credentials, setCredentials] = useState<IAgentCredential[]>(bot.credentials ?? [])
  // Bot memory state
  const [memoryContext,  setMemoryContext]  = useState<string | null>(null)
  const [loadingMemory,  setLoadingMemory]  = useState(false)
  const [clearingMemory, setClearingMemory] = useState(false)
  const [memoryCleaned,  setMemoryCleaned]  = useState(false)

  const loadMemoryPreview = async (): Promise<void> => {
    setLoadingMemory(true)
    const ctx = await useAgentsStore.getState().buildAgentMemoryContext(bot.id)
    setMemoryContext(ctx || null)
    setLoadingMemory(false)
  }

  const handleClearMemory = async (): Promise<void> => {
    setClearingMemory(true)
    await useAgentsStore.getState().clearAgentMemory(bot.id)
    setMemoryContext(null)
    setClearingMemory(false)
    setMemoryCleaned(true)
    setTimeout(() => { setMemoryCleaned(false) }, 2_000)
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    setSaving(true)
    await useAgentsStore.getState().updateAgent(bot.id, { name: name.trim(), description: desc.trim() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false) }, 2_000)
  }

  const handleSaveKey = async (): Promise<void> => {
    setSavingKey(true)
    const trimmed = apiKey.trim()
    if (trimmed) {
      await useAgentsStore.getState().updateAgent(bot.id, { apiKey: trimmed })
    } else {
      useAgentsStore.getState().clearAgentApiKey(bot.id)
    }
    setSavingKey(false)
    setSavedKey(true)
    setTimeout(() => { setSavedKey(false) }, 2_000)
  }

  const handleSaveProvider = async (): Promise<void> => {
    setSavingProv(true)
    if (aiProvider) {
      await useAgentsStore.getState().updateAgent(bot.id, { aiProvider })
    } else {
      useAgentsStore.getState().clearAgentAiProvider(bot.id)
    }
    setSavingProv(false)
    setSavedProv(true)
    setTimeout(() => { setSavedProv(false) }, 2_000)
  }

  return (
    <div className="space-y-6">
      {/* Active Run — shown only when the bot is currently executing */}
      {isRunning && (
        <section>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-blue-400">Active Run</p>
          <div className="flex items-center justify-between rounded-2xl border border-blue-400/30 bg-blue-400/5 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Bot is currently running</p>
                <p className="text-xs text-[var(--color-text-muted)]">Stop will cancel execution and mark the run as cancelled.</p>
              </div>
            </div>
            <button
              onClick={onStop}
              className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-2 text-xs font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/20"
            >
              ■ Stop Activity
            </button>
          </div>
        </section>
      )}
      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Identity</p>
        <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">Bot Name</label>
            <input value={name} onChange={(e) => { setName(e.target.value) }} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">Description</label>
            <textarea value={desc} onChange={(e) => { setDesc(e.target.value) }} rows={3} className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]" />
          </div>
          <button onClick={() => { void handleSave() }} disabled={!name.trim() || saving} className="rounded-xl bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50">
            {saved ? 'Saved' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </section>
      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">API Key</p>
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            Override the global AI key for this bot only.
            Leave blank to use the app-wide key from <span className="font-medium text-[var(--color-text-primary)]">Settings › API Keys</span>.
          </p>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value) }}
              placeholder="sk-… or leave blank to inherit global key"
              spellCheck={false}
              autoComplete="off"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 pr-16 font-mono text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
            />
            <button
              type="button"
              onClick={() => { setShowKey((v) => !v) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { void handleSaveKey() }}
              disabled={savingKey}
              className="rounded-xl bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {savedKey ? '✓ Saved' : savingKey ? 'Saving…' : 'Save Key'}
            </button>
            {apiKey.trim() && (
              <button
                type="button"
                onClick={() => {
                  setApiKey('')
                  useAgentsStore.getState().clearAgentApiKey(bot.id)
                }}
                className="text-xs text-[var(--color-danger)] hover:underline"
              >
                Clear Key
              </button>
            )}
            {bot.apiKey && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--color-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                Custom key active
              </span>
            )}
          </div>
        </div>
      </section>
      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">AI Provider</p>
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            Override the AI provider for this bot. Leave on <span className="font-medium text-[var(--color-text-primary)]">Auto</span> to inherit
            the app-wide provider from <span className="font-medium text-[var(--color-text-primary)]">Settings › API Keys</span>.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: '',          label: 'Auto',    icon: '✦', hint: 'App default' },
              { value: 'openai',    label: 'OpenAI',  icon: '⬡', hint: 'GPT-4o' },
              { value: 'anthropic', label: 'Anthropic', icon: '◈', hint: 'Claude' },
              { value: 'gemini',    label: 'Gemini',  icon: '◇', hint: 'Gemini 2.0' },
              { value: 'groq',      label: 'Groq',    icon: '⚡', hint: 'Llama 3' },
              { value: 'ollama',    label: 'Ollama',  icon: '🦙', hint: 'Local model' },
            ] as const).map(({ value, label, icon, hint }) => {
              const active = aiProvider === value
              return (
                <button
                  key={value || '__auto'}
                  type="button"
                  onClick={() => { setAiProvider(value) }}
                  className={[
                    'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                    active
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50',
                  ].join(' ')}
                >
                  <span className="text-base leading-none">{icon}</span>
                  <span className={`mt-1 text-xs font-semibold ${active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>{label}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{hint}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { void handleSaveProvider() }}
              disabled={savingProv}
              className="rounded-xl bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {savedProv ? '✓ Saved' : savingProv ? 'Saving…' : 'Save Provider'}
            </button>
            {bot.aiProvider && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--color-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                Custom provider active
              </span>
            )}
          </div>
        </div>
      </section>
      {/* ── Bot Memory ─────────────────────────────────────────────────────── */}
      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Private Memory</p>
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            This bot's private memory — preferences, learned behaviours, and past context — is stored
            <span className="font-medium text-[var(--color-text-primary)]"> locally on your machine</span> and automatically
            injected into every AI call.
          </p>
          {/* Scope pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Private',  hint: `bot:${bot.id.slice(0, 8)}…`, color: 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/8' },
              { label: 'Shared',   hint: 'workspace:shared',            color: 'border-[var(--color-border)] text-[var(--color-text-muted)]' },
              { label: 'Ephemeral',hint: 'task:runId',                  color: 'border-[var(--color-border)] text-[var(--color-text-muted)]' },
            ].map(({ label, hint, color }) => (
              <div key={label} className={`rounded-lg border px-3 py-1.5 ${color}`}>
                <p className="text-[10px] font-semibold">{label}</p>
                <p className="font-mono text-[9px] opacity-70">{hint}</p>
              </div>
            ))}
          </div>
          {/* Context preview */}
          {memoryContext !== null && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Context Preview</p>
              <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                {memoryContext}
              </p>
            </div>
          )}
          {memoryContext === null && !loadingMemory && (
            <p className="text-xs italic text-[var(--color-text-muted)]">No private memories stored yet for this bot.</p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { void loadMemoryPreview() }}
              disabled={loadingMemory}
              className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              {loadingMemory ? 'Loading…' : 'Preview Memory'}
            </button>
            <button
              onClick={() => { void handleClearMemory() }}
              disabled={clearingMemory}
              className="rounded-xl border border-[var(--color-danger)]/40 px-4 py-2 text-xs font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
            >
              {memoryCleaned ? '✓ Cleared' : clearingMemory ? 'Clearing…' : 'Clear Memory'}
            </button>
          </div>
        </div>
      </section>
      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Credentials</p>
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            Store login credentials, API tokens, or any data the bot needs when interacting with external
            services. Saved <span className="font-medium text-[var(--color-text-primary)]">locally only</span> — never sent to the server.
          </p>
          {credentials.length > 0 && (
            <div className="space-y-2">
              {credentials.map((cred, idx) => (
                <CredentialRow
                  key={idx}
                  cred={cred}
                  onRemove={() => {
                    const next = credentials.filter((_, i) => i !== idx)
                    setCredentials(next)
                    useAgentsStore.getState().updateAgentCredentials(bot.id, next)
                  }}
                />
              ))}
            </div>
          )}
          <AddCredentialForm
            onAdd={(cred) => {
              const next = [...credentials, cred]
              setCredentials(next)
              useAgentsStore.getState().updateAgentCredentials(bot.id, next)
            }}
          />
          {credentials.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCredentials([])
                useAgentsStore.getState().updateAgentCredentials(bot.id, [])
              }}
              className="text-xs text-[var(--color-danger)] hover:underline"
            >
              Clear all credentials
            </button>
          )}
        </div>
      </section>
      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Info</p>
        <div className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {[
            { label: 'Bot ID',   value: bot.id },
            { label: 'Template', value: template?.name ?? 'Custom' },
            { label: 'Sync',     value: bot.synced ? 'Cloud' : 'Local only' },
            { label: 'Created',  value: new Date(bot.created_at).toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3">
              <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
              <p className="text-xs font-medium text-[var(--color-text-primary)] capitalize">{value}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Status</p>
        <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{bot.status === 'active' ? 'Active' : 'Paused'}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{bot.status === 'active' ? 'Bot will run when triggered.' : 'Bot is paused and will not execute.'}</p>
          </div>
          <button
            onClick={() => { void useAgentsStore.getState().toggleStatus(bot.id) }}
            className={`rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
              bot.status === 'active'
                ? 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
            }`}
          >
            {bot.status === 'active' ? 'Pause Bot' : 'Activate Bot'}
          </button>
        </div>
      </section>
      {template && (
        <section>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Template</p>
          <div className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
            <span className="text-3xl">{template.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{template.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{template.description}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${colorClass}`}>{template.name}</span>
          </div>
        </section>
      )}
      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-red-400">Danger Zone</p>
        <div className="flex items-center justify-between rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-surface)] px-5 py-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Delete this bot</p>
            <p className="text-xs text-[var(--color-text-muted)]">All run history will be permanently erased.</p>
          </div>
          <button onClick={onDelete} className="rounded-xl border border-[var(--color-danger)]/40 px-4 py-2 text-xs font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10">
            Delete
          </button>
        </div>
      </section>
    </div>
  )
}

// ─── AgentRunPanel ──────────────────────────────────────────────────────────────

export interface IAgentRunPanelProps { onBack: () => void }

export function AgentRunPanel({ onBack }: IAgentRunPanelProps): React.JSX.Element {
  const selectedBotId = useAgentsStore((s) => s.selectedBotId)
  const bots          = useAgentsStore((s) => s.agents)
  const runs          = useAgentsStore((s) => s.runs)
  const runningBotIds = useAgentsStore((s) => s.runningBotIds)
  const setView       = useAppStore((s) => s.setView)

  const bot       = bots.find((b) => b.id === selectedBotId)
  const botRuns   = selectedBotId ? (runs[selectedBotId] ?? []) : []
  const isRunning = selectedBotId !== null && runningBotIds.includes(selectedBotId)
  const hasActive = botRuns.some((r) => ACTIVE_STATUSES.has(r.status))
  const latestRun = botRuns[0]

  const template   = bot?.templateId ? findTemplate(bot.templateId) : undefined
  const colorClass = template?.colorClass ?? 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
  const hasCustom  = bot?.templateId !== undefined && bot.templateId in MODULE_PANELS

  const [tab, setTab]             = useState<AgentTab>('chat')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!hasCustom && tab === 'custom') setTab('chat')
  }, [hasCustom, tab])

  useEffect(() => {
    if (!selectedBotId || !hasActive) return
    const timer = setInterval(() => { void useAgentsStore.getState().loadRuns(selectedBotId) }, 5_000)
    return () => { clearInterval(timer) }
  }, [selectedBotId, hasActive])

  useEffect(() => {
    if (!bot) setView('agents')
  }, [bot, setView])

  if (!bot) return <div />

  const busy             = isRunning || hasActive

  const handleDelete = (): void => {
    void useAgentsStore.getState().deleteAgent(bot.id).then(() => { onBack() })
  }

  const customTabLabel = template ? `${template.icon} ${template.name}` : ''
  const tabs: { id: AgentTab; label: string }[] = [
    { id: 'chat',     label: '💬 Chat' },
    ...(hasCustom ? [{ id: 'custom' as AgentTab, label: customTabLabel }] : []),
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-bg)]">
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 pb-0 pt-4">
        <div className="flex items-center gap-3 pb-4">
          <button onClick={onBack} className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-xl">
            {template?.icon ?? '🤖'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold text-[var(--color-text-primary)]">{bot.name}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${bot.status === 'active' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : 'bg-yellow-400/15 text-yellow-400'}`}>
                {bot.status}
              </span>
              {template && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${colorClass}`}>{template.name}</span>
              )}
              {bot.synced
                ? <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">Cloud</span>
                : <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">Local</span>
              }
              {isRunning && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" /> Running
                </span>
              )}
            </div>
            {bot.description && <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{bot.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {bot.status === 'active' && (
              <button
                onClick={() => { useAgentsStore.getState().stopAgent(bot.id) }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-2 text-xs font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/20"
              >
                {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                Stop
              </button>
            )}
            {bot.status === 'paused' && (
              <button
                onClick={() => { void useAgentsStore.getState().toggleStatus(bot.id) }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 px-4 py-2 text-xs font-semibold text-[var(--color-success)] transition-colors hover:bg-[var(--color-success)]/20"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Activate
              </button>
            )}
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-surface)] px-2 py-1">
                <span className="text-[11px] text-[var(--color-text-secondary)]">Delete?</span>
                <button
                  onClick={handleDelete}
                  className="rounded-lg bg-[var(--color-danger)] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:opacity-80"
                >
                  Delete
                </button>
                <button
                  onClick={() => { setConfirmDelete(false) }}
                  className="rounded-lg px-2 py-1 text-[11px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setConfirmDelete(true) }}
                disabled={busy}
                aria-label="Delete bot"
                title="Delete bot"
                className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] disabled:pointer-events-none disabled:opacity-40"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id) }}
              className={`rounded-t-lg px-4 py-2 text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {/* Live execution progress — shown above tab content on ALL tabs */}
      {isRunning && latestRun?.plannedSteps && (
        <div className="shrink-0 border-b border-blue-400/15 px-6 py-4">
          <RunProgress botId={bot.id} runId={latestRun.id} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl">
          {tab === 'custom' && hasCustom && (
            <CustomTabContent bot={bot} latestRun={latestRun} />
          )}
          {tab === 'chat' && (
            <ChatTabErrorBoundary botName={bot.name}>
              <ChatTab
                bot={bot}
                botRuns={botRuns}
              />
            </ChatTabErrorBoundary>
          )}
          {tab === 'settings' && (
            <SettingsTab
              bot={bot}
              template={template}
              colorClass={colorClass}
              onDelete={handleDelete}
              isRunning={isRunning}
              onStop={() => { useAgentsStore.getState().stopAgent(bot.id) }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export { AgentRunPanel as AgentsPanel }
