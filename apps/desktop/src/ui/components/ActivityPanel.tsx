/**
 * ActivityPanel.tsx — Live activity feed with interactive controls.
 *
 * Features:
 *  • Live step stepper — shows plannedSteps + reached logs with ✓ / ● / ○ markers
 *  • Stop button on running runs; Re-run on failed / cancelled / completed (local)
 *  • Copy output to clipboard
 *  • Auto-polling every 3 s while any run is active
 *  • Date grouping (Today / Yesterday / This week / Month Year)
 *  • Sort toggle (newest first / oldest first)
 *  • Success-rate stat in the stats bar
 *  • "Running N" live pill in the header
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBotStore, type IDesktopBotRun, type RunStatus } from '../store/bot-store.js'
import type { AppView } from '../store/app-store.js'

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

function dayBucket(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86_400_000)
  const thisWeek = new Date(today.getTime() - 6 * 86_400_000)
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (target.getTime() === today.getTime()) return 'Today'
  if (target.getTime() === yesterday.getTime()) return 'Yesterday'
  if (target >= thisWeek) return 'This week'
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIGS: Record<RunStatus, { dot: string; badge: string; label: string }> = {
  pending:   { dot: 'bg-yellow-400',               badge: 'bg-yellow-400/15 text-yellow-400',                           label: 'Pending'   },
  running:   { dot: 'animate-pulse bg-blue-400',    badge: 'bg-blue-400/15 text-blue-400',                               label: 'Running'   },
  completed: { dot: 'bg-[var(--color-success)]',    badge: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',   label: 'Completed' },
  failed:    { dot: 'bg-[var(--color-danger)]',     badge: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',     label: 'Failed'    },
  cancelled: { dot: 'bg-[var(--color-text-muted)]', badge: 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]', label: 'Cancelled' },
}

const ALL_STATUSES: RunStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled']

// ─── Flat run record (bot name joined in) ────────────────────────────────────

interface IFlatRun extends IDesktopBotRun {
  botName: string
}

// ─── Copy hook ────────────────────────────────────────────────────────────────

function useCopy(text: string): [boolean, () => void] {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 2_000)
    })
  }, [text])
  return [copied, copy]
}

// ─── StepStepper ──────────────────────────────────────────────────────────────

/** Renders a vertical stepper for plannedSteps + logs progress. */
function StepStepper({ run }: { run: IFlatRun }): React.JSX.Element | null {
  const planned = run.plannedSteps ?? []
  const reached = run.logs ?? []
  if (planned.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        Steps
      </p>
      <div className="space-y-1.5 pl-0.5">
        {planned.map((label, i) => {
          const done   = i < reached.length
          const active = i === reached.length && run.status === 'running'
          return (
            <div key={i} className="flex items-start gap-2.5">
              {/* Marker */}
              <div className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center">
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="var(--color-success)" strokeWidth="1.5" />
                    <path d="M5 8l2 2 4-4" stroke="var(--color-success)" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : active ? (
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full border border-[var(--color-border)]
                                   bg-[var(--color-surface-2)]" />
                )}
              </div>
              {/* Label */}
              <span className={`text-[11px] leading-snug ${
                done    ? 'text-[var(--color-text-muted)] line-through decoration-[var(--color-text-muted)]/50'
                : active ? 'font-medium text-blue-400'
                : 'text-[var(--color-text-muted)]'
              }`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

/** Displays total / completed / failed / running counts + success rate. */
function StatsBar({ runs }: { runs: IFlatRun[] }): React.JSX.Element {
  const counts = useMemo(() => {
    const acc: Record<string, number> = { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 }
    for (const r of runs) acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, [runs])

  const done = (counts.completed ?? 0) + (counts.failed ?? 0)
  const successRate = done > 0 ? Math.round(((counts.completed ?? 0) / done) * 100) : null
  const rateColor = successRate === null
    ? 'text-[var(--color-text-muted)]'
    : successRate >= 80 ? 'text-[var(--color-success)]'
    : successRate >= 50 ? 'text-yellow-400'
    : 'text-[var(--color-danger)]'

  const items = [
    { label: 'Total',     value: String(runs.length),          accent: 'text-[var(--color-text-primary)]' },
    { label: 'Completed', value: String(counts.completed ?? 0), accent: 'text-[var(--color-success)]' },
    { label: 'Failed',    value: String(counts.failed ?? 0),    accent: 'text-[var(--color-danger)]' },
    { label: 'Running',   value: String(counts.running ?? 0),   accent: 'text-blue-400' },
    { label: 'Success %', value: successRate !== null ? `${String(successRate)}%` : '—', accent: rateColor },
  ]

  return (
    <div className="grid grid-cols-5 gap-3">
      {items.map(({ label, value, accent }) => (
        <div
          key={label}
          className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
        >
          <p className={`text-xl font-bold ${accent}`}>{value}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Run row ──────────────────────────────────────────────────────────────────

interface IRunRowProps {
  run: IFlatRun
  onOpenBot: () => void
}

function RunRow({ run, onOpenBot }: IRunRowProps): React.JSX.Element {
  // Auto-expand when running or pending so the stepper is immediately visible.
  const [expanded, setExpanded] = useState(
    run.status === 'running' || run.status === 'pending',
  )
  const [copied, copy] = useCopy(run.result)
  const cfg = STATUS_CONFIGS[run.status]

  // Keep auto-expanded when a run transitions to running.
  useEffect(() => {
    if (run.status === 'running' || run.status === 'pending') setExpanded(true)
  }, [run.status])

  const hasExpandable = run.result.length > 0 || (run.plannedSteps?.length ?? 0) > 0
  const isReRunnable  = run.local && (
    run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled'
  )

  return (
    <div className={`rounded-xl border bg-[var(--color-surface)] transition-colors ${
      run.status === 'running'
        ? 'border-blue-400/40'
        : 'border-[var(--color-border)]'
    }`}>
      {/* ── Row header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status dot */}
        <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />

        {/* Bot name — navigates to bot detail */}
        <button
          onClick={onOpenBot}
          className="min-w-0 max-w-[160px] truncate text-left text-sm font-medium
                     text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
          title={run.botName}
        >
          {run.botName}
        </button>

        {/* Status badge */}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>
          {cfg.label}
        </span>

        {/* Step count */}
        {run.steps > 0 && (
          <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
            {String(run.steps)} step{run.steps !== 1 ? 's' : ''}
          </span>
        )}

        {/* Local badge */}
        {run.local && (
          <span className="shrink-0 rounded-full bg-[var(--color-surface-2)] px-2 py-0.5
                           text-[10px] text-[var(--color-text-muted)]">
            local
          </span>
        )}

        {/* Time + duration */}
        <span className="ml-auto shrink-0 text-[11px] text-[var(--color-text-muted)]">
          {relativeTime(run.started_at)}
          {run.ended_at && (
            <span className="ml-1.5">· {formatDuration(run.started_at, run.ended_at)}</span>
          )}
        </span>

        {/* ── Action buttons ─────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Stop — running only */}
          {run.status === 'running' && (
            <button
              onClick={() => { useBotStore.getState().stopBot(run.bot_id) }}
              title="Stop this run"
              className="flex h-6 w-6 items-center justify-center rounded-lg
                         bg-red-500/15 text-red-400 transition-colors hover:bg-red-500/30"
            >
              {/* Square stop icon */}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <rect x="1" y="1" width="8" height="8" rx="1.5" />
              </svg>
            </button>
          )}

          {/* Re-run — local completed / failed / cancelled */}
          {isReRunnable && (
            <button
              onClick={() => { void useBotStore.getState().runBot(run.bot_id) }}
              title="Run again"
              className="flex h-6 items-center gap-1 rounded-lg border border-[var(--color-border)]
                         px-2 text-[10px] text-[var(--color-text-muted)] transition-colors
                         hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]"
            >
              ↺ Re-run
            </button>
          )}

          {/* Expand / collapse */}
          {hasExpandable && (
            <button
              onClick={() => { setExpanded((v) => !v) }}
              title={expanded ? 'Collapse' : 'Expand'}
              className="flex h-6 w-6 items-center justify-center rounded-lg
                         text-[var(--color-text-muted)] transition-colors
                         hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
            >
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
              >
                <polyline points="2,3 5,7 8,3" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded section ────────────────────────────────────────────── */}
      {expanded && hasExpandable && (
        <div className="space-y-4 border-t border-[var(--color-border)] px-4 py-3">
          {/* Step stepper — shown whenever plannedSteps exist */}
          <StepStepper run={run} />

          {/* Output */}
          {run.result.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider
                                 text-[var(--color-text-muted)]">
                  Output
                </span>
                <button
                  onClick={copy}
                  className="flex items-center gap-1 rounded-lg border border-[var(--color-border)]
                             px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] transition-colors
                             hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]"
                >
                  {copied ? '✓ Copied' : '⎘ Copy'}
                </button>
              </div>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg
                              bg-[var(--color-surface-2)] p-3 text-xs leading-relaxed
                              text-[var(--color-text-secondary)]">
                {run.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Date group label ─────────────────────────────────────────────────────────

function DateGroupLabel({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs font-semibold text-[var(--color-text-muted)]">{label}</span>
      <div className="flex-1 border-t border-[var(--color-border)]" />
    </div>
  )
}

// ─── ActivityPanel ────────────────────────────────────────────────────────────

export interface IActivityPanelProps {
  onNavigate: (view: AppView) => void
}

/** ActivityPanel — live run history across all bots with interactive controls. */
export function ActivityPanel({ onNavigate }: IActivityPanelProps): React.JSX.Element {
  const bots    = useBotStore((s) => s.bots)
  const runs    = useBotStore((s) => s.runs)
  const loading = useBotStore((s) => s.loading)

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<RunStatus | 'all'>('all')
  const [botFilter,    setBotFilter]    = useState<string>('all')
  const [refreshing,   setRefreshing]   = useState(false)
  const [sortOrder,    setSortOrder]    = useState<'newest' | 'oldest'>('newest')
  const [groupByDate,  setGroupByDate]  = useState(true)

  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadAll = useCallback(async (): Promise<void> => {
    await useBotStore.getState().loadBots()
    const { bots: loaded } = useBotStore.getState()
    await Promise.all(loaded.map((b) => useBotStore.getState().loadRuns(b.id)))
  }, [])

  // Initial load.
  useEffect(() => { void loadAll() }, [loadAll])

  // Flatten runs once so useMemo below is stable.
  const allRuns: IFlatRun[] = useMemo(() => {
    const flat: IFlatRun[] = []
    for (const [botId, botRuns] of Object.entries(runs)) {
      const bot = bots.find((b) => b.id === botId)
      for (const r of botRuns) flat.push({ ...r, botName: bot?.name ?? 'Unknown bot' })
    }
    flat.sort((a, b) => {
      const diff = new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      return sortOrder === 'newest' ? diff : -diff
    })
    return flat
  }, [runs, bots, sortOrder])

  // Auto-poll every 3 s while any run is active (running or pending).
  const hasActive = useMemo(
    () => allRuns.some((r) => r.status === 'running' || r.status === 'pending'),
    [allRuns],
  )

  useEffect(() => {
    if (hasActive) {
      liveTimerRef.current = setInterval(() => { void loadAll() }, 3_000)
    } else if (liveTimerRef.current !== null) {
      clearInterval(liveTimerRef.current)
      liveTimerRef.current = null
    }
    return () => {
      if (liveTimerRef.current !== null) {
        clearInterval(liveTimerRef.current)
        liveTimerRef.current = null
      }
    }
  }, [hasActive, loadAll])

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true)
    try { await loadAll() } finally { setRefreshing(false) }
  }

  // Apply search + status + bot filters.
  const filtered = useMemo(() => allRuns.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (botFilter !== 'all' && r.bot_id !== botFilter) return false
    if (search.length > 0) {
      const q = search.toLowerCase()
      if (
        !r.botName.toLowerCase().includes(q) &&
        !r.result.toLowerCase().includes(q) &&
        !r.status.toLowerCase().includes(q)
      ) return false
    }
    return true
  }), [allRuns, statusFilter, botFilter, search])

  // Group filtered runs by date bucket if groupByDate is on.
  const grouped: { label: string; items: IFlatRun[] }[] = useMemo(() => {
    if (!groupByDate) return [{ label: '', items: filtered }]
    const map = new Map<string, IFlatRun[]>()
    for (const r of filtered) {
      const bucket = dayBucket(r.started_at)
      const existing = map.get(bucket) ?? []
      existing.push(r)
      map.set(bucket, existing)
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
  }, [filtered, groupByDate])

  const openBot = (botId: string): void => {
    useBotStore.getState().selectBot(botId)
    onNavigate('bot-run')
  }

  const activeCount = allRuns.filter((r) => r.status === 'running').length

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Activity</h1>
              {/* Live "N running" pill */}
              {activeCount > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-blue-400/15
                                 px-2.5 py-0.5 text-[11px] font-medium text-blue-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                  {String(activeCount)} running
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Live run history across all bots.
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2">
            {/* Group-by-date toggle */}
            <button
              onClick={() => { setGroupByDate((v) => !v) }}
              title="Group by date"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs
                          transition-colors ${
                groupByDate
                  ? 'border-[var(--color-accent)]/50 text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]'
              }`}
            >
              {/* Calendar icon */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Group
            </button>

            {/* Sort order toggle */}
            <button
              onClick={() => { setSortOrder((v) => (v === 'newest' ? 'oldest' : 'newest')) }}
              title="Toggle sort order"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)]
                         px-3 py-2 text-xs text-[var(--color-text-secondary)] transition-colors
                         hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]"
            >
              {/* Arrow icon — rotates for sort direction */}
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform ${sortOrder === 'oldest' ? 'rotate-180' : ''}`}
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19,12 12,19 5,12" />
              </svg>
              {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
            </button>

            {/* Manual refresh */}
            <button
              onClick={() => { void handleRefresh() }}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)]
                         px-3 py-2 text-xs text-[var(--color-text-secondary)] transition-colors
                         hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]
                         disabled:opacity-50"
            >
              <span className={refreshing ? 'animate-spin' : ''}>↺</span>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-4xl space-y-6">

          {/* Stats bar */}
          <StatsBar runs={allRuns} />

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2
                           text-[var(--color-text-muted)]"
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by bot, status, or output…"
                value={search}
                onChange={(e) => { setSearch(e.target.value) }}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]
                           py-2.5 pl-9 pr-4 text-sm text-[var(--color-text-primary)]
                           placeholder-[var(--color-text-secondary)] outline-none
                           focus:border-[var(--color-accent)] transition-colors"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as RunStatus | 'all') }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]
                         px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            >
              <option value="all">All statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_CONFIGS[s].label}</option>
              ))}
            </select>

            <select
              value={botFilter}
              onChange={(e) => { setBotFilter(e.target.value) }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]
                         px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            >
              <option value="all">All bots</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Results count + live auto-refresh indicator */}
          {allRuns.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--color-text-muted)]">
                {filtered.length === allRuns.length
                  ? `${String(allRuns.length)} run${allRuns.length !== 1 ? 's' : ''} total`
                  : `${String(filtered.length)} of ${String(allRuns.length)} runs`}
              </p>
              {hasActive && (
                <p className="text-[10px] text-blue-400">● Auto-refreshing every 3 s</p>
              )}
            </div>
          )}

          {/* Empty state */}
          {allRuns.length === 0 && !loading && !refreshing ? (
            <div className="flex flex-col items-center justify-center rounded-2xl
                            border border-dashed border-[var(--color-border)] py-20 text-center">
              <p className="text-4xl">📋</p>
              <p className="mt-4 text-base font-medium text-[var(--color-text-primary)]">
                No activity yet
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Create a bot and run it — runs will appear here.
              </p>
              <button
                onClick={() => { onNavigate('bots') }}
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-accent-dim)]
                           px-4 py-2 text-sm font-medium text-[var(--color-accent)]
                           transition-colors hover:bg-[var(--color-accent)] hover:text-white"
              >
                Go to Bots
              </button>
            </div>
          ) : filtered.length === 0 && allRuns.length > 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)]
                            px-6 py-12 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">
                No runs match your filters.
              </p>
              <button
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                  setBotFilter('all')
                }}
                className="mt-3 text-xs text-[var(--color-accent)] hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(({ label, items }) => (
                <div key={label} className="space-y-2">
                  {groupByDate && label && <DateGroupLabel label={label} />}
                  {items.map((run) => (
                    <RunRow
                      key={run.id}
                      run={run}
                      onOpenBot={() => { openBot(run.bot_id) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
