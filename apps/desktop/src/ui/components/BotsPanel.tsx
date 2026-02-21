/**
 * BotsPanel.tsx
 *
 * Bot detail panel with three tabs:
 *   - Custom UI  - rich per-template/category widget (hidden for bots with no template)
 *   - Detail     - goal editing, run CTA, latest output, chat, run history
 *   - Settings   - name, description, status, danger zone
 */

import React, { useEffect, useRef, useState } from 'react'
import { useBotStore, type IDesktopBot, type IDesktopBotRun, type IChatMessage } from '../store/bot-store.js'
import { useAppStore } from '../store/app-store.js'
import {
  BOT_TEMPLATES,
  BOT_TYPE_CATALOG,
  TEMPLATE_CATEGORY_COLORS,
  type IBotTemplate,
} from '../store/bot-templates.js'
import { CryptoPanel } from './modules/CryptoPanel.js'
import { WritingHelperPanel } from './modules/WritingHelperPanel.js'

const ALL_TEMPLATES = [...BOT_TEMPLATES, ...BOT_TYPE_CATALOG]

// ─── Tab type ──────────────────────────────────────────────────────────────────

type BotTab = 'chat' | 'custom' | 'settings'

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
  const runs   = useBotStore((s) => s.runs)
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

function RunHistorySection({ botRuns, botId }: { botRuns: IDesktopBotRun[]; botId: string }): React.JSX.Element {
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
            onClick={() => { void useBotStore.getState().loadRuns(botId) }}
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

interface IChatTabProps {
  bot: IDesktopBot
  botRuns: IDesktopBotRun[]
}

function ChatTab({ bot, botRuns }: IChatTabProps): React.JSX.Element {
  const messages   = useBotStore((s) => s.chatHistory[bot.id] ?? ([] as IChatMessage[]))
  const isThinking = useBotStore((s) => s.thinkingBotIds.includes(bot.id))
  const error      = useBotStore((s) => s.error)
  const [input, setInput]             = useState('')
  const [showGoal, setShowGoal]       = useState(false)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft]     = useState('')
  const bottomRef                     = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isThinking])

  const handleSend = (): void => {
    const text = input.trim()
    if (!text || isThinking) return
    setInput('')
    void useBotStore.getState().sendMessage(bot.id, text)
  }

  const handleSaveGoal = async (): Promise<void> => {
    if (!goalDraft.trim()) return
    await useBotStore.getState().updateBot(bot.id, { goal: goalDraft.trim() })
    setEditingGoal(false)
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          <span>{error}</span>
          <button onClick={() => { useBotStore.getState().clearError() }} className="ml-4 text-xs underline">Dismiss</button>
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => { if (!showGoal) setGoalDraft(bot.goal); setShowGoal((v) => !v); setEditingGoal(false) }}
            className="text-[10px] text-[var(--color-accent)] hover:underline"
          >
            {showGoal ? 'Hide goal' : 'View goal'}
          </button>
          <button
            onClick={() => { useBotStore.getState().clearChat(bot.id) }}
            className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Collapsible goal / instructions strip */}
      {showGoal && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Goal / Instructions</p>
            {!editingGoal && (
              <button onClick={() => { setGoalDraft(bot.goal); setEditingGoal(true) }} className="text-[10px] text-[var(--color-accent)] hover:underline">Edit</button>
            )}
          </div>
          {editingGoal ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={goalDraft}
                onChange={(e) => { setGoalDraft(e.target.value) }}
                rows={4}
                className="w-full resize-y rounded-lg border border-[var(--color-accent)] bg-[var(--color-surface-2)] px-3 py-2 text-sm leading-relaxed text-[var(--color-text-primary)] outline-none"
              />
              <div className="flex gap-2">
                <button onClick={() => { void handleSaveGoal() }} disabled={!goalDraft.trim()} className="rounded-lg bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-white disabled:opacity-50">Save</button>
                <button onClick={() => { setEditingGoal(false) }} className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)]">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{bot.goal}</p>
          )}
        </div>
      )}

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
                    {bot.templateId ? (ALL_TEMPLATES.find((t) => t.id === bot.templateId)?.icon ?? '🤖') : '🤖'}
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
                          onClick={() => { void useBotStore.getState().confirmRun(bot.id, m.id) }}
                          className="rounded-lg bg-[var(--color-success)] px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        >
                          ✅ Yes, run it
                        </button>
                        <button
                          onClick={() => { useBotStore.getState().dismissRun(bot.id, m.id) }}
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
                {bot.templateId ? (ALL_TEMPLATES.find((t) => t.id === bot.templateId)?.icon ?? '🤖') : '🤖'}
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

interface ICustomTabProps { template: IBotTemplate; bot: IDesktopBot; latestRun?: IDesktopBotRun | undefined }

function FinanceWidget({ template, bot, latestRun }: ICustomTabProps): React.JSX.Element {
  const isStock    = template.id === 'stock-screener'
  const lines      = latestRun?.result ? latestRun.result.split('\n').filter(Boolean) : []
  const highlights = lines.slice(0, 6)
  const mockTickers = isStock
    ? [
        { symbol: 'AAPL', price: '172.34', change: '+1.2%', up: true },
        { symbol: 'MSFT', price: '420.11', change: '+0.8%', up: true },
        { symbol: 'NVDA', price: '875.50', change: '-0.4%', up: false },
        { symbol: 'TSLA', price: '183.20', change: '+2.1%', up: true },
      ]
    : [
        { symbol: 'BTC', price: '67,420', change: '+3.4%', up: true },
        { symbol: 'ETH', price: '3,512',  change: '+1.8%', up: true },
        { symbol: 'SOL', price: '148.30', change: '-0.9%', up: false },
        { symbol: 'BNB', price: '571.10', change: '+0.5%', up: true },
      ]
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-emerald-500/10 to-transparent p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{isStock ? 'Screener' : 'Crypto Watch'}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{template.icon} {template.name}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{bot.description}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--color-text-muted)]">Last run</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{latestRun ? relativeTime(latestRun.started_at) : 'Never'}</p>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{isStock ? 'Watched Stocks' : 'Watched Assets'}</p>
        <div className="grid grid-cols-2 gap-3">
          {mockTickers.map((t) => (
            <div key={t.symbol} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <div>
                <p className="text-xs font-bold text-[var(--color-text-primary)]">{t.symbol}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">$ {t.price}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.up ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {t.change}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[9px] text-[var(--color-text-muted)]">Prices are illustrative; live data populated after first run.</p>
      </div>
      {highlights.length > 0 ? (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Latest Analysis</p>
          <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            {highlights.map((line, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                {line}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-8 text-center">
          <p className="text-2xl">{template.icon}</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Run this bot to populate live market data.</p>
        </div>
      )}
    </div>
  )
}

function ResearchWidget({ template, bot, latestRun }: ICustomTabProps): React.JSX.Element {
  const paragraphs = latestRun?.result ? latestRun.result.split('\n').filter(Boolean) : []
  const findings   = paragraphs.slice(0, 5)
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-purple-500/10 to-transparent p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Research</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{template.icon} {template.name}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{bot.description}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--color-text-muted)]">Reports</p>
            <p className="text-2xl font-bold text-purple-400">{latestRun ? '1' : '0'}</p>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Sources</p>
        <div className="space-y-2">
          {['Wikipedia', 'Google News', 'ArXiv', 'HackerNews'].map((src) => (
            <div key={src} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              <span className="text-sm text-[var(--color-text-primary)]">{src}</span>
              <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">pending</span>
            </div>
          ))}
        </div>
      </div>
      {findings.length > 0 ? (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Key Findings</p>
          <div className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            {findings.map((line, i) => (
              <p key={i} className="px-5 py-3 text-sm leading-relaxed text-[var(--color-text-primary)]">{line}</p>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-8 text-center">
          <p className="text-2xl">{template.icon}</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Run the bot to generate a research report.</p>
        </div>
      )}
    </div>
  )
}

function AutomationWidget({ template, bot, latestRun }: ICustomTabProps): React.JSX.Element {
  const PIPELINE_STEPS = ['Parse trigger', 'Fetch data', 'Process & transform', 'Generate output', 'Save / deliver']
  const completedUntil = latestRun?.status === 'completed' ? PIPELINE_STEPS.length
    : latestRun?.status === 'running' ? 2 : 0
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-orange-500/10 to-transparent p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Automation</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{template.icon} {template.name}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{bot.description}</p>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
            latestRun?.status === 'running' ? 'bg-blue-400/15 text-blue-400'
            : latestRun?.status === 'completed' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
            : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
          }`}>
            {latestRun?.status ?? 'idle'}
          </div>
        </div>
      </div>
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Pipeline</p>
        <ol className="space-y-2">
          {PIPELINE_STEPS.map((step, i) => {
            const done   = i < completedUntil
            const active = i === completedUntil && latestRun?.status === 'running'
            return (
              <li key={step} className="flex items-center gap-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                  done ? 'bg-[var(--color-success)] text-white'
                  : active ? 'animate-pulse bg-blue-400 text-white'
                  : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
                }`}>
                  {done ? '✓' : active ? '…' : String(i + 1)}
                </span>
                <p className={`flex-1 text-sm ${done || active ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>{step}</p>
                {done   && <span className="text-[10px] text-[var(--color-success)]">done</span>}
                {active && <span className="text-[10px] text-blue-400">running</span>}
              </li>
            )
          })}
        </ol>
      </div>
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Schedule</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Trigger',  value: 'Manual' },
            { label: 'Last Run', value: latestRun ? relativeTime(latestRun.started_at) : 'Never' },
            { label: 'Duration', value: latestRun ? formatDuration(latestRun.started_at, latestRun.ended_at) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
              <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CreativeWidget({ template, bot, latestRun }: ICustomTabProps): React.JSX.Element {
  const draft     = latestRun?.result ?? ''
  const wordCount = draft ? draft.split(/\s+/).filter(Boolean).length : 0
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-pink-500/10 to-transparent p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Creative</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{template.icon} {template.name}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{bot.description}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--color-text-muted)]">Words</p>
            <p className="text-2xl font-bold text-pink-400">{String(wordCount)}</p>
          </div>
        </div>
      </div>
      {draft && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Words',      value: String(wordCount) },
            { label: 'Characters', value: String(draft.length) },
            { label: 'Generated',  value: latestRun ? relativeTime(latestRun.started_at) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-center">
              <p className="text-lg font-bold text-[var(--color-text-primary)]">{value}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
            </div>
          ))}
        </div>
      )}
      {draft ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Draft Output</p>
            <button
              onClick={() => { void navigator.clipboard.writeText(draft) }}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-[10px] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              Copy
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">{draft}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-8 text-center">
          <p className="text-2xl">{template.icon}</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Run the bot to generate your first draft.</p>
        </div>
      )}
    </div>
  )
}

function ProductivityWidget({ template, bot, latestRun }: ICustomTabProps): React.JSX.Element {
  const rawLines    = latestRun?.result ? latestRun.result.split('\n').filter(Boolean) : []
  const bulletItems = rawLines.filter((l) => /^[*-]/.test(l.trim())).slice(0, 10)
  const prose       = rawLines.filter((l) => !/^[*-]/.test(l.trim())).slice(0, 3)
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-blue-500/10 to-transparent p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Productivity</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{template.icon} {template.name}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{bot.description}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--color-text-muted)]">Items</p>
            <p className="text-2xl font-bold text-blue-400">{String(bulletItems.length || rawLines.length)}</p>
          </div>
        </div>
      </div>
      {prose.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          {prose.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-[var(--color-text-primary)]">{p}</p>
          ))}
        </div>
      )}
      {bulletItems.length > 0 ? (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Items</p>
          <div className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            {bulletItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5 shrink-0 text-[var(--color-success)]">✓</span>
                <span className="text-sm text-[var(--color-text-primary)]">{item.replace(/^[*-]\s*/, '')}</span>
              </div>
            ))}
          </div>
        </div>
      ) : !latestRun ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-8 text-center">
          <p className="text-2xl">{template.icon}</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Run the bot to populate your digest.</p>
        </div>
      ) : null}
    </div>
  )
}

function CustomTabContent({ template, bot, latestRun }: { template?: IBotTemplate | undefined; bot: IDesktopBot; latestRun?: IDesktopBotRun | undefined }): React.JSX.Element | null {
  if (!template) return null
  // Special interactive tool templates — render their full interactive panel embedded.
  if (template.id === 'crypto-analysis') return <CryptoPanel embedded />
  if (template.id === 'writing-helper')  return <WritingHelperPanel embedded />
  const props: ICustomTabProps = { template, bot, latestRun }
  switch (template.category) {
    case 'finance':      return <FinanceWidget      {...props} />
    case 'research':     return <ResearchWidget     {...props} />
    case 'automation':   return <AutomationWidget   {...props} />
    case 'creative':     return <CreativeWidget     {...props} />
    case 'productivity': return <ProductivityWidget {...props} />
  }
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({ bot, template, colorClass, onDelete, isRunning, onStop }: {
  bot: IDesktopBot
  template?: IBotTemplate | undefined
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

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    setSaving(true)
    await useBotStore.getState().updateBot(bot.id, { name: name.trim(), description: desc.trim() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false) }, 2_000)
  }

  const handleSaveKey = async (): Promise<void> => {
    setSavingKey(true)
    const trimmed = apiKey.trim()
    if (trimmed) {
      await useBotStore.getState().updateBot(bot.id, { apiKey: trimmed })
    } else {
      // Clear the key by patching with an empty object — the store's spread will
      // preserve the existing apiKey unless we delete it explicitly.
      const bots = useBotStore.getState().bots.map((b) =>
        b.id === bot.id ? (() => { const { apiKey: _k, ...rest } = b; return rest as typeof b })() : b,
      )
      useBotStore.setState({ bots })
    }
    setSavingKey(false)
    setSavedKey(true)
    setTimeout(() => { setSavedKey(false) }, 2_000)
  }

  const handleSaveProvider = async (): Promise<void> => {
    setSavingProv(true)
    if (aiProvider) {
      await useBotStore.getState().updateBot(bot.id, { aiProvider })
    } else {
      const bots = useBotStore.getState().bots.map((b) =>
        b.id === bot.id ? (() => { const { aiProvider: _p, ...rest } = b; return rest as typeof b })() : b,
      )
      useBotStore.setState({ bots })
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
                  const bots = useBotStore.getState().bots.map((b) =>
                    b.id === bot.id ? (() => { const { apiKey: _k, ...rest } = b; return rest as typeof b })() : b,
                  )
                  useBotStore.setState({ bots })
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
      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Info</p>
        <div className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {[
            { label: 'Bot ID',   value: bot.id },
            { label: 'Template', value: template?.name ?? 'Custom' },
            { label: 'Category', value: template?.category ?? '—' },
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
            onClick={() => { void useBotStore.getState().toggleStatus(bot.id) }}
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
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${colorClass}`}>{template.category}</span>
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

// ─── BotRunPanel ──────────────────────────────────────────────────────────────

export interface IBotRunPanelProps { onBack: () => void }

export function BotRunPanel({ onBack }: IBotRunPanelProps): React.JSX.Element {
  const selectedBotId = useBotStore((s) => s.selectedBotId)
  const bots          = useBotStore((s) => s.bots)
  const runs          = useBotStore((s) => s.runs)
  const runningBotIds = useBotStore((s) => s.runningBotIds)
  const setView       = useAppStore((s) => s.setView)

  const bot       = bots.find((b) => b.id === selectedBotId)
  const botRuns   = selectedBotId ? (runs[selectedBotId] ?? []) : []
  const isRunning = selectedBotId !== null && runningBotIds.includes(selectedBotId)
  const hasActive = botRuns.some((r) => ACTIVE_STATUSES.has(r.status))
  const latestRun = botRuns[0]

  const template   = bot?.templateId ? ALL_TEMPLATES.find((t) => t.id === bot.templateId) : undefined
  const colorClass = template ? TEMPLATE_CATEGORY_COLORS[template.category] : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
  const hasCustom  = template !== undefined

  const [tab, setTab] = useState<BotTab>('chat')

  useEffect(() => {
    if (!hasCustom && tab === 'custom') setTab('chat')
  }, [hasCustom, tab])

  useEffect(() => {
    if (!selectedBotId || !hasActive) return
    const timer = setInterval(() => { void useBotStore.getState().loadRuns(selectedBotId) }, 5_000)
    return () => { clearInterval(timer) }
  }, [selectedBotId, hasActive])

  useEffect(() => {
    if (!bot) setView('bots')
  }, [bot, setView])

  if (!bot) return <div />

  const busy             = isRunning || hasActive

  const handleDelete = (): void => {
    if (!window.confirm(`Delete bot "${bot.name}"? This cannot be undone.`)) return
    void useBotStore.getState().deleteBot(bot.id).then(() => { onBack() })
  }

  const customTabLabel = template ? `${template.icon} ${template.name}` : ''
  const tabs: { id: BotTab; label: string }[] = [
    { id: 'chat',     label: '💬 Chat' },
    ...(hasCustom ? [{ id: 'custom' as BotTab, label: customTabLabel }] : []),
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
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${colorClass}`}>{template.category}</span>
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
          {busy && (
            <button
              onClick={() => { useBotStore.getState().stopBot(bot.id) }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-2 text-xs font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/20"
            >
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Stop
            </button>
          )}
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
            <CustomTabContent template={template} bot={bot} latestRun={latestRun} />
          )}
          {tab === 'chat' && (
            <ChatTab
              bot={bot}
              botRuns={botRuns}
            />
          )}
          {tab === 'settings' && (
            <SettingsTab
              bot={bot}
              template={template}
              colorClass={colorClass}
              onDelete={handleDelete}
              isRunning={isRunning}
              onStop={() => { useBotStore.getState().stopBot(bot.id) }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export { BotRunPanel as BotsPanel }
