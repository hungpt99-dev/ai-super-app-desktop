/**
 * BotsPanel.tsx
 *
 * Bot detail panel with three tabs:
 *   - Custom UI  - rich per-template/category widget (hidden for bots with no template)
 *   - Detail     - goal editing, run CTA, latest output, chat, run history
 *   - Settings   - name, description, status, danger zone
 */

import React, { useEffect, useRef, useState } from 'react'
import { useBotStore, type IDesktopBot, type IDesktopBotRun } from '../store/bot-store.js'
import { useAuthStore } from '../store/auth-store.js'
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

type BotTab = 'custom' | 'detail' | 'settings'

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

// ─── Shared chat ─────────────────────────────────────────────────────────────

interface IChatMessage { role: 'user' | 'assistant'; content: string; ts: number }

function BotChat({ bot, latestResult }: { bot: IDesktopBot; latestResult?: string | undefined }): React.JSX.Element {
  const [messages, setMessages] = useState<IChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (latestResult && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `I just finished a run. Here is a summary:\n\n${latestResult.slice(0, 400)}${latestResult.length > 400 ? '…' : ''}\n\nAsk me anything.`,
        ts: Date.now(),
      }])
    }
  }, [latestResult]) // seed once

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = (): void => {
    const text = input.trim()
    if (!text || thinking) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text, ts: Date.now() }])
    setThinking(true)
    setTimeout(() => {
      const ctx = latestResult
        ? `Bot goal: "${bot.goal}". Latest output excerpt: "${latestResult.slice(0, 200)}".`
        : `Bot goal: "${bot.goal}".`
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: text.endsWith('?')
            ? `Based on ${ctx} — this bot is designed to ${bot.goal.toLowerCase().slice(0, 100)}.`
            : `Got it. I will keep that in mind for the next run.`,
          ts: Date.now(),
        },
      ])
      setThinking(false)
    }, 900)
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-border)] px-5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Chat with this Bot
        </p>
      </div>
      <div className="min-h-[160px] max-h-60 flex-1 overflow-y-auto space-y-3 px-5 py-4">
        {messages.length === 0 && (
          <p className="pt-4 text-center text-xs text-[var(--color-text-muted)]">
            Ask about this bot&apos;s goal or latest output.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.ts} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)]'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-[var(--color-surface-2)] px-4 py-2.5">
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
      <div className="flex gap-2 border-t border-[var(--color-border)] px-4 py-3">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Ask about this bot..."
          className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-accent)]"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || thinking}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
        >
          ↑
        </button>
      </div>
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

// ─── Detail tab ───────────────────────────────────────────────────────────────

interface IDetailTabProps {
  bot: IDesktopBot
  botRuns: IDesktopBotRun[]
  latestRun?: IDesktopBotRun | undefined
  canRun: boolean
  isRunning: boolean
  runLabel: string
  hasSignInWarning: boolean
}

function DetailTab({ bot, botRuns, latestRun, canRun, isRunning, runLabel, hasSignInWarning }: IDetailTabProps): React.JSX.Element {
  const error = useBotStore((s) => s.error)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft]     = useState('')

  const handleSaveGoal = async (): Promise<void> => {
    if (!goalDraft.trim()) return
    await useBotStore.getState().updateBot(bot.id, { goal: goalDraft.trim() })
    setEditingGoal(false)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          <span>{error}</span>
          <button onClick={() => { useBotStore.getState().clearError() }} className="ml-4 text-xs underline">Dismiss</button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Runs',  value: String(botRuns.length) },
          { label: 'Last Run',    value: latestRun ? relativeTime(latestRun.started_at) : 'Never' },
          { label: 'Last Status', value: latestRun?.status ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
            <p className="mt-1 truncate text-sm font-medium text-[var(--color-text-primary)] capitalize">{value}</p>
          </div>
        ))}
      </div>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Goal</p>
          {!editingGoal && (
            <button onClick={() => { setGoalDraft(bot.goal); setEditingGoal(true) }} className="text-[10px] text-[var(--color-accent)] hover:underline">
              Edit
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
              <button onClick={() => { void handleSaveGoal() }} disabled={!goalDraft.trim()} className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50">Save</button>
              <button onClick={() => { setEditingGoal(false) }} className="rounded-lg border border-[var(--color-border)] px-4 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
            <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">{bot.goal}</p>
          </div>
        )}
      </section>
      {hasSignInWarning && (
        <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-400">
          Sign in to queue this bot for cloud execution.
        </div>
      )}
      <div className="flex items-center gap-4">
        <button
          disabled={!canRun}
          onClick={() => { void useBotStore.getState().runBot(bot.id) }}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          {runLabel}
        </button>
      </div>
      {/* Live execution progress — visible while the bot is running */}
      {isRunning && latestRun?.plannedSteps && (
        <RunProgress botId={bot.id} runId={latestRun.id} />
      )}
      {/* Latest output — visible only after a completed / failed run */}
      {!isRunning && latestRun?.result && (
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Latest Output</p>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">{latestRun.result}</p>
          </div>
        </section>
      )}
      <BotChat bot={bot} latestResult={latestRun?.result ?? undefined} />
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Run History
            {botRuns.length > 0 && (
              <span className="ml-2 rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px]">{String(botRuns.length)}</span>
            )}
          </p>
          <button onClick={() => { void useBotStore.getState().loadRuns(bot.id) }} className="text-xs text-[var(--color-accent)] transition-opacity hover:opacity-70">
            Refresh
          </button>
        </div>
        {botRuns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] px-6 py-10 text-center">
            <p className="text-2xl">📋</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No runs yet. Hit <strong>Run</strong> to execute this bot.</p>
          </div>
        ) : (
          <div className="space-y-2">{botRuns.map((run) => <RunItem key={run.id} run={run} />)}</div>
        )}
      </section>
    </div>
  )
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
  const [apiKey,    setApiKey]    = useState(bot.apiKey ?? '')
  const [showKey,   setShowKey]   = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [savedKey,  setSavedKey]  = useState(false)

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
  const { user }      = useAuthStore()
  const setView       = useAppStore((s) => s.setView)

  const bot       = bots.find((b) => b.id === selectedBotId)
  const botRuns   = selectedBotId ? (runs[selectedBotId] ?? []) : []
  const isRunning = selectedBotId !== null && runningBotIds.includes(selectedBotId)
  const hasActive = botRuns.some((r) => ACTIVE_STATUSES.has(r.status))
  const latestRun = botRuns[0]

  const template   = bot?.templateId ? ALL_TEMPLATES.find((t) => t.id === bot.templateId) : undefined
  const colorClass = template ? TEMPLATE_CATEGORY_COLORS[template.category] : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
  const hasCustom  = template !== undefined

  const [tab, setTab] = useState<BotTab>(hasCustom ? 'custom' : 'detail')

  useEffect(() => {
    if (!hasCustom && tab === 'custom') setTab('detail')
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
  const canRun           = !busy && !(bot.synced && !user) && bot.status === 'active'
  const hasSignInWarning = bot.synced && !user

  const runLabel = busy
    ? (bot.synced ? 'Queuing...' : 'Running...')
    : bot.status === 'paused' ? 'Bot Paused'
    : bot.synced  ? 'Queue Run' : 'Run Locally'

  const handleDelete = (): void => {
    if (!window.confirm(`Delete bot "${bot.name}"? This cannot be undone.`)) return
    void useBotStore.getState().deleteBot(bot.id).then(() => { onBack() })
  }

  const customTabLabel = template ? `${template.icon} ${template.name}` : ''
  const tabs: { id: BotTab; label: string }[] = [
    ...(hasCustom ? [{ id: 'custom' as BotTab, label: customTabLabel }] : []),
    { id: 'detail',   label: 'Detail' },
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
          {busy ? (
            <button
              onClick={() => { useBotStore.getState().stopBot(bot.id) }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-2 text-xs font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/20"
            >
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Stop
            </button>
          ) : (
            <button
              disabled={!canRun}
              onClick={() => { void useBotStore.getState().runBot(bot.id); setTab('detail') }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Run
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
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl">
          {tab === 'custom' && hasCustom && (
            <CustomTabContent template={template} bot={bot} latestRun={latestRun} />
          )}
          {tab === 'detail' && (
            <DetailTab
              bot={bot}
              botRuns={botRuns}
              latestRun={latestRun}
              canRun={canRun}
              isRunning={isRunning}
              runLabel={runLabel}
              hasSignInWarning={hasSignInWarning}
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
