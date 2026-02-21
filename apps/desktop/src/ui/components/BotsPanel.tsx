/**
 * BotsPanel.tsx — exports BotRunPanel
 *
 * Each bot opens as a first-class panel with:
 *   • Custom UI widget — unique per bot category/template
 *   • Chat interface — shared across all bots (goal-aware conversation)
 *   • Run button + live output + run history
 */

import React, { useEffect, useRef, useState } from 'react'
import { useBotStore, type IDesktopBotRun } from '../store/bot-store.js'
import { useAuthStore } from '../store/auth-store.js'
import { useAppStore } from '../store/app-store.js'
import {
  BOT_TEMPLATES,
  BOT_TYPE_CATALOG,
  TEMPLATE_CATEGORY_COLORS,
  type IBotTemplate,
} from '../store/bot-templates.js'

const ALL_TEMPLATES = [...BOT_TEMPLATES, ...BOT_TYPE_CATALOG]

// ─── Per-category custom UI widgets ──────────────────────────────────────────

/** Renders a unique UI panel based on bot category / template. */
function BotCustomWidget({ template, latestResult }: { template?: IBotTemplate | undefined; latestResult?: string | undefined }): React.JSX.Element | null {
  const category = template?.category

  if (category === 'finance') {
    // Finance bots: price ticker mock + result highlights
    const lines = latestResult?.split('\n').filter(Boolean).slice(0, 5) ?? []
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">📈 Latest Data</p>
        {lines.length > 0 ? (
          <ul className="space-y-1.5">
            {lines.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Run the bot to see market data here.</p>
        )}
      </div>
    )
  }

  if (category === 'research') {
    // Research bots: topic and structured output
    const lines = latestResult?.split('\n').filter(Boolean).slice(0, 6) ?? []
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">🔍 Research Output</p>
        {lines.length > 0 ? (
          <div className="space-y-1">
            {lines.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-[var(--color-text-primary)]">{line}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Research results will appear here after the first run.</p>
        )}
      </div>
    )
  }

  if (category === 'automation') {
    // Automation bots: pipeline step tracker
    const steps = latestResult
      ? latestResult.split('\n').filter(Boolean).map((s, i) => ({ label: s, done: i < 3 })).slice(0, 5)
      : [
          { label: 'Trigger event', done: false },
          { label: 'Process data', done: false },
          { label: 'Generate output', done: false },
          { label: 'Save results', done: false },
        ]
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">⚙️ Pipeline</p>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                step.done
                  ? 'bg-[var(--color-success)] text-white'
                  : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}>
                {step.done ? '✓' : String(i + 1)}
              </span>
              <span className={step.done ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}>
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  if (category === 'creative') {
    // Creative bots: latest output shown as a formatted card
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">✨ Draft Output</p>
        {latestResult ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
            {latestResult.slice(0, 300)}{latestResult.length > 300 ? '…' : ''}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Draft content will appear here after the first run.</p>
        )}
      </div>
    )
  }

  if (category === 'productivity') {
    // Productivity bots: checklist view of bullet points
    const items = latestResult?.split('\n').filter((l) => l.trim().startsWith('•') || l.trim().startsWith('-') || l.trim().startsWith('*')).slice(0, 8) ?? []
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">📋 Checklist</p>
        {items.length > 0 ? (
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                <span className="mt-0.5 shrink-0 text-[var(--color-success)]">✓</span>
                {item.replace(/^[•\-*]\s*/, '')}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Output items will appear here after the first run.</p>
        )}
      </div>
    )
  }

  return null
}

// ─── Shared chat interface ────────────────────────────────────────────────────

interface IChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

interface IBotChatProps {
  botGoal: string
  latestResult?: string | undefined
}

function BotChat({ botGoal, latestResult }: IBotChatProps): React.JSX.Element {
  const [messages, setMessages]   = useState<IChatMessage[]>([])
  const [input, setInput]         = useState('')
  const [thinking, setThinking]   = useState(false)
  const bottomRef                 = useRef<HTMLDivElement>(null)

  // Seed an initial context message when latestResult arrives.
  useEffect(() => {
    if (latestResult && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `I just ran this bot. Here's a summary of the output:\n\n${latestResult.slice(0, 400)}${latestResult.length > 400 ? '…' : ''}\n\nAsk me anything about it.`,
        ts: Date.now(),
      }])
    }
  }, [latestResult]) // only seed once when first result arrives

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (): void => {
    const text = input.trim()
    if (!text || thinking) return
    setInput('')
    const userMsg: IChatMessage = { role: 'user', content: text, ts: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setThinking(true)
    // Simulate AI response (real implementation routes through gateway-client)
    setTimeout(() => {
      const context = latestResult
        ? `Bot goal: "${botGoal}". Latest output: "${latestResult.slice(0, 200)}".`
        : `Bot goal: "${botGoal}".`
      const reply: IChatMessage = {
        role: 'assistant',
        content: `Based on ${context} — ${text.endsWith('?') ? 'here\'s my answer: this bot is designed to ' + botGoal.toLowerCase().slice(0, 80) + '.' : 'Got it. I\'ll keep that in mind for the next run.'}`,
        ts: Date.now(),
      }
      setMessages((prev) => [...prev, reply])
      setThinking(false)
    }, 900)
  }

  return (
    <section className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="border-b border-[var(--color-border)] px-5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">💬 Chat with this Bot</p>
      </div>

      {/* Message list */}
      <div className="flex-1 min-h-[180px] max-h-64 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-[var(--color-text-muted)] pt-6">
            Ask the bot anything about its goal or latest output.
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.ts} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-[var(--color-surface-2)] px-4 py-2.5">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)]" style={{ animationDelay: `${String(Math.round(i * 150))}ms` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--color-border)] px-4 py-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Ask about this bot…"
          className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)] transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || thinking}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
        >
          ↑
        </button>
      </div>
    </section>
  )
}



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

function RunItem({ run }: { run: IDesktopBotRun }): React.JSX.Element {
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
        {run.local && <span className="text-[10px] text-[var(--color-text-muted)]">local</span>}
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
        <p className="mt-2 whitespace-pre-wrap pl-5 text-xs text-[var(--color-text-secondary)]">
          {run.result}
        </p>
      )}
    </div>
  )
}

// ─── BotRunPanel ──────────────────────────────────────────────────────────────

export interface IBotRunPanelProps {
  onBack: () => void
}

/**
 * BotRunPanel — renders a user-created bot as a first-class feature panel,
 * identical in chrome to CryptoPanel / WritingHelperPanel.
 */
export function BotRunPanel({ onBack }: IBotRunPanelProps): React.JSX.Element {
  const selectedBotId = useBotStore((s) => s.selectedBotId)
  const bots          = useBotStore((s) => s.bots)
  const runs          = useBotStore((s) => s.runs)
  const runningBotIds = useBotStore((s) => s.runningBotIds)
  const error         = useBotStore((s) => s.error)
  const { user }      = useAuthStore()
  const setView       = useAppStore((s) => s.setView)

  const bot       = bots.find((b) => b.id === selectedBotId)
  const botRuns   = selectedBotId ? (runs[selectedBotId] ?? []) : []
  const isRunning = selectedBotId !== null && runningBotIds.includes(selectedBotId)
  const hasActive = botRuns.some((r) => ACTIVE_STATUSES.has(r.status))
  const latestRun = botRuns[0]

  const template    = bot?.templateId ? ALL_TEMPLATES.find((t) => t.id === bot.templateId) : undefined
  const colorClass  = template ? TEMPLATE_CATEGORY_COLORS[template.category] : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'

  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft]     = useState('')

  const handleEditGoal = (): void => {
    if (!bot) return
    setGoalDraft(bot.goal)
    setEditingGoal(true)
  }

  const handleSaveGoal = async (): Promise<void> => {
    if (!bot || !goalDraft.trim()) return
    await useBotStore.getState().updateBot(bot.id, { goal: goalDraft.trim() })
    setEditingGoal(false)
  }

  // Auto-poll while a run is active.
  useEffect(() => {
    if (!selectedBotId || !hasActive) return
    const timer = setInterval(
      () => { void useBotStore.getState().loadRuns(selectedBotId) },
      5_000,
    )
    return () => { clearInterval(timer) }
  }, [selectedBotId, hasActive])

  // Guard: if no bot is selected go back to bots.
  useEffect(() => {
    if (!bot) setView('bots')
  }, [bot, setView])

  if (!bot) return <div />

  const busy   = isRunning || hasActive
  const canRun = !busy && !(bot.synced && !user) && bot.status === 'active'

  const runLabel = busy
    ? (bot.synced ? '⏳ Queuing…' : '⏳ Running…')
    : bot.status === 'paused'
      ? '⏸ Bot Paused'
      : bot.synced
        ? '▶ Queue Run'
        : '▶ Run Locally'

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-bg)]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors
                       hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
          >
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
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  bot.status === 'active'
                    ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                    : 'bg-yellow-400/15 text-yellow-400'
                }`}
              >
                {bot.status}
              </span>
              {template && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${colorClass}`}>
                  {template.name}
                </span>
              )}
              {bot.synced ? (
                <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">☁ Cloud</span>
              ) : (
                <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">💾 Local</span>
              )}
            </div>
            {bot.description && (
              <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{bot.description}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => { void useBotStore.getState().toggleStatus(bot.id) }}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs
                         text-[var(--color-text-secondary)] transition-colors
                         hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]"
            >
              {bot.status === 'active' ? '⏸ Pause' : '▷ Activate'}
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete bot "${bot.name}"?`)) {
                  void (async () => {
                    await useBotStore.getState().deleteBot(bot.id)
                    onBack()
                  })()
                }
              }}
              className="rounded-lg border border-[var(--color-danger)]/30 p-1.5 text-sm
                         text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10"
            >
              🗑
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-2xl space-y-6">

          {error && (
            <div className="flex items-center justify-between rounded-xl bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
              <span>{error}</span>
              <button onClick={() => { useBotStore.getState().clearError() }} className="ml-4 text-xs underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Bot info row */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Type',    value: template?.name ?? 'Custom' },
              { label: 'Runs',    value: String(botRuns.length) },
              { label: 'Status',  value: bot.status },
              { label: 'Created', value: new Date(bot.created_at).toLocaleDateString() },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
                <p className="mt-1 truncate text-sm font-medium text-[var(--color-text-primary)] capitalize">{value}</p>
              </div>
            ))}
          </section>

          {/* Goal — inline editable */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Goal</p>
              {!editingGoal && (
                <button
                  onClick={handleEditGoal}
                  className="text-[10px] text-[var(--color-accent)] hover:underline"
                >
                  ✏ Edit
                </button>
              )}
            </div>
            {editingGoal ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={goalDraft}
                  onChange={(e) => { setGoalDraft(e.target.value) }}
                  rows={5}
                  className="w-full resize-y rounded-xl border border-[var(--color-accent)] bg-[var(--color-surface)] px-5 py-4 text-sm leading-relaxed text-[var(--color-text-primary)] outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { void handleSaveGoal() }}
                    disabled={!goalDraft.trim()}
                    className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingGoal(false) }}
                    className="rounded-lg border border-[var(--color-border)] px-4 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
                <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">{bot.goal}</p>
              </div>
            )}
          </section>

          {/* Per-type custom widget */}
          <BotCustomWidget template={template} latestResult={latestRun?.result ?? undefined} />

          {bot.synced && !user && (
            <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-400">
              ⚠ Sign in to queue this bot for cloud execution.
            </div>
          )}

          {/* Run CTA */}
          <div className="flex items-center gap-4">
            <button
              disabled={!canRun}
              onClick={() => { void useBotStore.getState().runBot(bot.id) }}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-2.5
                         text-sm font-semibold text-white transition-colors
                         hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {runLabel}
            </button>
            {!bot.synced && user && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Sign in with a paid plan for multi-device execution.
              </p>
            )}
          </div>

          {/* Latest output */}
          {latestRun?.result && (
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Latest Output</p>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {latestRun.result}
                </p>
              </div>
            </section>
          )}

          {/* Chat with this bot */}
          <BotChat botGoal={bot.goal} latestResult={latestRun?.result ?? undefined} />

          {/* Run history */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Run History
                {botRuns.length > 0 && (
                  <span className="ml-2 rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px]">
                    {String(botRuns.length)}
                  </span>
                )}
              </p>
              <button
                onClick={() => { void useBotStore.getState().loadRuns(bot.id) }}
                className="text-xs text-[var(--color-accent)] transition-opacity hover:opacity-70"
              >
                ↺ Refresh
              </button>
            </div>
            {botRuns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] px-6 py-10 text-center">
                <p className="text-2xl">📋</p>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  No runs yet. Hit <strong>Run</strong> to execute this bot.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {botRuns.map((run) => <RunItem key={run.id} run={run} />)}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}

// Re-export as BotsPanel so App.tsx import needs no change.
export { BotRunPanel as BotsPanel }

