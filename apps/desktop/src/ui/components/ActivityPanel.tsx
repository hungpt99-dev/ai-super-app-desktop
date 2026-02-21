/**
 * ActivityPanel.tsx
 *
 * Full run-history log across every bot.
 * Features: per-status / per-bot filters, search, stats bar, expandable rows.
 */

import React, { useEffect, useMemo, useState } from 'react'
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

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIGS: Record<RunStatus, { dot: string; badge: string; label: string }> = {
  pending:   { dot: 'bg-yellow-400',                  badge: 'bg-yellow-400/15 text-yellow-400',                       label: 'Pending' },
  running:   { dot: 'animate-pulse bg-blue-400',       badge: 'bg-blue-400/15 text-blue-400',                           label: 'Running' },
  completed: { dot: 'bg-[var(--color-success)]',       badge: 'bg-[var(--color-success)]/15 text-[var(--color-success)]', label: 'Completed' },
  failed:    { dot: 'bg-[var(--color-danger)]',        badge: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',   label: 'Failed' },
  cancelled: { dot: 'bg-[var(--color-text-muted)]',   badge: 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]', label: 'Cancelled' },
}

const ALL_STATUSES: RunStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled']

// ─── Flat run record (bot name joined in) ────────────────────────────────────

interface IFlatRun extends IDesktopBotRun {
  botName: string
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ runs }: { runs: IFlatRun[] }): React.JSX.Element {
  const counts = useMemo(() => {
    const acc: Record<string, number> = { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 }
    for (const r of runs) acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, [runs])

  const items = [
    { label: 'Total',     value: runs.length,          accent: 'text-[var(--color-text-primary)]' },
    { label: 'Completed', value: counts.completed ?? 0, accent: 'text-[var(--color-success)]' },
    { label: 'Failed',    value: counts.failed ?? 0,    accent: 'text-[var(--color-danger)]' },
    { label: 'Running',   value: counts.running ?? 0,   accent: 'text-blue-400' },
    { label: 'Pending',   value: counts.pending ?? 0,   accent: 'text-yellow-400' },
  ]

  return (
    <div className="grid grid-cols-5 gap-3">
      {items.map(({ label, value, accent }) => (
        <div
          key={label}
          className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
        >
          <p className={`text-xl font-bold ${accent}`}>{String(value)}</p>
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
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIGS[run.status]

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status dot */}
        <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />

        {/* Bot name */}
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

        {/* Steps */}
        {run.steps > 0 && (
          <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
            {String(run.steps)} step{run.steps !== 1 ? 's' : ''}
          </span>
        )}

        {/* Local badge */}
        {run.local && (
          <span className="shrink-0 rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
            local
          </span>
        )}

        {/* Time + duration */}
        <span className="ml-auto shrink-0 text-[11px] text-[var(--color-text-muted)]">
          {relativeTime(run.started_at)}
          {run.ended_at && <span className="ml-1.5">· {formatDuration(run.started_at, run.ended_at)}</span>}
        </span>

        {/* Expand toggle */}
        {run.result && (
          <button
            onClick={() => { setExpanded((v) => !v) }}
            className="shrink-0 text-[11px] text-[var(--color-accent)] hover:underline"
          >
            {expanded ? 'Hide' : 'Output'}
          </button>
        )}
      </div>

      {/* Expanded output */}
      {expanded && run.result && (
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {run.result}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── ActivityPanel ────────────────────────────────────────────────────────────

export interface IActivityPanelProps {
  onNavigate: (view: AppView) => void
}

/** ActivityPanel — full chronological run history across all bots, with filters. */
export function ActivityPanel({ onNavigate }: IActivityPanelProps): React.JSX.Element {
  const bots        = useBotStore((s) => s.bots)
  const runs        = useBotStore((s) => s.runs)
  const loading     = useBotStore((s) => s.loading)

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<RunStatus | 'all'>('all')
  const [botFilter,    setBotFilter]    = useState<string>('all')
  const [refreshing,   setRefreshing]   = useState(false)

  // Load all bots + their runs on mount.
  useEffect(() => {
    void (async () => {
      await useBotStore.getState().loadBots()
      const { bots: loaded } = useBotStore.getState()
      await Promise.all(loaded.map((b) => useBotStore.getState().loadRuns(b.id)))
    })()
  }, [])

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await useBotStore.getState().loadBots()
      const { bots: loaded } = useBotStore.getState()
      await Promise.all(loaded.map((b) => useBotStore.getState().loadRuns(b.id)))
    } finally {
      setRefreshing(false)
    }
  }

  // Flatten + sort all runs newest-first.
  const allRuns: IFlatRun[] = useMemo(() => {
    const flat: IFlatRun[] = []
    for (const [botId, botRuns] of Object.entries(runs)) {
      const bot = bots.find((b) => b.id === botId)
      for (const r of botRuns) {
        flat.push({ ...r, botName: bot?.name ?? 'Unknown bot' })
      }
    }
    flat.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    return flat
  }, [runs, bots])

  // Apply filters.
  const filtered = useMemo(() => {
    return allRuns.filter((r) => {
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
    })
  }, [allRuns, statusFilter, botFilter, search])

  const openBot = (botId: string): void => {
    useBotStore.getState().selectBot(botId)
    onNavigate('bot-run')
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Activity</h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Run history across all your bots.
            </p>
          </div>
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-4xl space-y-6">

          {/* Stats */}
          <StatsBar runs={allRuns} />

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by bot name, status, or output…"
                value={search}
                onChange={(e) => { setSearch(e.target.value) }}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]
                           py-2.5 pl-9 pr-4 text-sm text-[var(--color-text-primary)]
                           placeholder-[var(--color-text-secondary)] outline-none
                           focus:border-[var(--color-accent)] transition-colors"
              />
            </div>

            {/* Status filter */}
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

            {/* Bot filter */}
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

          {/* Results count */}
          {allRuns.length > 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {filtered.length === allRuns.length
                ? `${String(allRuns.length)} run${allRuns.length !== 1 ? 's' : ''} total`
                : `${String(filtered.length)} of ${String(allRuns.length)} runs`}
            </p>
          )}

          {/* Empty state */}
          {allRuns.length === 0 && !loading && !refreshing ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] py-20 text-center">
              <p className="text-4xl">📋</p>
              <p className="mt-4 text-base font-medium text-[var(--color-text-primary)]">No activity yet</p>
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
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-12 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">No runs match your filters.</p>
              <button
                onClick={() => { setSearch(''); setStatusFilter('all'); setBotFilter('all') }}
                className="mt-3 text-xs text-[var(--color-accent)] hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  onOpenBot={() => { openBot(run.bot_id) }}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
