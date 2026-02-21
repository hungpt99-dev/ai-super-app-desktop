/**
 * BotsPanel.tsx
 *
 * Bot management panel for the Desktop app.
 *
 * Features
 * ────────
 * • List all bots (local + cloud-synced) in a scrollable left column.
 * • Create a new bot — saved locally when offline, on the server when authenticated.
 * • Select a bot to view its goal, status, and run history in the right column.
 * • Run a bot: queues on the server (cloud bots) or executes locally (local bots).
 * • Auto-polls run history when a run is pending or running.
 *
 * No account is required — bots work fully offline with localStorage persistence.
 * Cloud sync and cross-device execution activate automatically on sign-in.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useBotStore, type IDesktopBot, type IDesktopBotRun } from '../store/bot-store.js'
import { useAuthStore } from '../store/auth-store.js'

// ─── Constants & helpers ───────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(['pending', 'running'])

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

// ─── Create Bot Modal ─────────────────────────────────────────────────────────

interface ICreateBotModalProps {
  loading: boolean
  onSubmit: (name: string, description: string, goal: string) => Promise<void>
  onClose: () => void
}

function CreateBotModal({ loading, onSubmit, onClose }: ICreateBotModalProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || !goal.trim()) return
    setLocalError(null)
    try {
      await onSubmit(name.trim(), description.trim(), goal.trim())
    } catch (err) {
      setLocalError((err as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--color-border)]
                   bg-[var(--color-surface)] p-6 shadow-2xl"
      >
        <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">New Bot</h2>

        <form onSubmit={(e) => { void handleSubmit(e) }} className="flex flex-col gap-3">
          {/* Name */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Name *</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value) }}
              placeholder="Daily digest"
              required
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            />
          </label>

          {/* Description */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Description</span>
            <input
              value={description}
              onChange={(e) => { setDescription(e.target.value) }}
              placeholder="Short description (optional)"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            />
          </label>

          {/* Goal */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Goal *</span>
            <textarea
              value={goal}
              onChange={(e) => { setGoal(e.target.value) }}
              placeholder="Open Chrome, visit example.com, read the headline, write a summary."
              required
              rows={4}
              className="resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            />
          </label>

          {localError && (
            <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
              {localError}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm
                         text-[var(--color-text-secondary)] transition-colors
                         hover:text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !goal.trim()}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium
                         text-white transition-colors hover:bg-[var(--color-accent-hover)]
                         disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Bot List Item ─────────────────────────────────────────────────────────────

interface IBotListItemProps {
  bot: IDesktopBot
  isSelected: boolean
  isRunning: boolean
  onClick: () => void
}

function BotListItem({ bot, isSelected, isRunning, onClick }: IBotListItemProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full rounded-xl border px-3 py-2.5 text-left transition-all',
        isSelected
          ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent-dim)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-surface-2)]',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-sm">🤖</span>
        <p
          className={`flex-1 truncate text-sm font-medium ${
            isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
          }`}
        >
          {bot.name}
        </p>
        {isRunning && (
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-blue-400" />
        )}
        {bot.synced ? (
          <span title="Synced to cloud" className="shrink-0 text-[10px] text-[var(--color-text-muted)]">
            ☁
          </span>
        ) : (
          <span title="Local only" className="shrink-0 text-[10px] text-[var(--color-text-muted)]">
            💾
          </span>
        )}
      </div>
      {bot.description && (
        <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
          {bot.description}
        </p>
      )}
    </button>
  )
}

// ─── Run Item ─────────────────────────────────────────────────────────────────

function RunItem({ run }: { run: IDesktopBotRun }): React.JSX.Element {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-[var(--color-border)]
                 bg-[var(--color-surface)] px-4 py-3"
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[run.status] ?? ''}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[run.status] ?? ''}`}
          >
            {run.status}
          </span>
          {run.steps > 0 && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {String(run.steps)} step{run.steps !== 1 ? 's' : ''}
            </span>
          )}
          {run.local && (
            <span className="text-[10px] text-[var(--color-text-muted)]">local</span>
          )}
        </div>
        {run.result && (
          <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
            {run.result}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right text-[10px] text-[var(--color-text-muted)]">
        <p>{relativeTime(run.started_at)}</p>
        <p className="mt-0.5">{formatDuration(run.started_at, run.ended_at)}</p>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-5xl">🤖</span>
      <div>
        <p className="text-base font-semibold text-[var(--color-text-primary)]">No bot selected</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Create a bot or select one from the list to view its details and run history.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium
                   text-white transition-colors hover:bg-[var(--color-accent-hover)]"
      >
        + New Bot
      </button>
    </div>
  )
}

// ─── Bot Detail ───────────────────────────────────────────────────────────────

interface IBotDetailProps {
  bot: IDesktopBot
  runs: IDesktopBotRun[]
  isRunning: boolean
  isAuthenticated: boolean
  onDelete: () => Promise<void>
  onToggleStatus: () => Promise<void>
  onRun: () => Promise<void>
  onRefreshRuns: () => void
}

function BotDetail({
  bot,
  runs,
  isRunning,
  isAuthenticated,
  onDelete,
  onToggleStatus,
  onRun,
  onRefreshRuns,
}: IBotDetailProps): React.JSX.Element {
  const [actionLoading, setActionLoading] = useState(false)

  const wrap = (fn: () => Promise<void>) => async (): Promise<void> => {
    setActionLoading(true)
    try { await fn() } finally { setActionLoading(false) }
  }

  const hasActiveRun = runs.some((r) => ACTIVE_STATUSES.has(r.status))
  const busy = isRunning || hasActiveRun || actionLoading
  const canRun = !busy && !(bot.synced && !isAuthenticated) && bot.status === 'active'

  const runLabel = (): string => {
    if (isRunning) return bot.synced ? '⏳ Queuing…' : '⏳ Running…'
    if (hasActiveRun) return '⏳ In Progress'
    if (bot.status === 'paused') return '⏸ Paused'
    return bot.synced ? '▶ Queue Run' : '▶ Run Locally'
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Bot header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--color-border)] px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: name + badges */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-[var(--color-text-primary)]">
                {bot.name}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  bot.status === 'active'
                    ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                    : 'bg-yellow-400/15 text-yellow-400'
                }`}
              >
                {bot.status}
              </span>
              {bot.synced ? (
                <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                  ☁ Cloud
                </span>
              ) : (
                <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
                  💾 Local
                </span>
              )}
            </div>
            {bot.description && (
              <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                {bot.description}
              </p>
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              disabled={actionLoading}
              onClick={() => { void wrap(onToggleStatus)() }}
              title={bot.status === 'active' ? 'Pause bot' : 'Activate bot'}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs
                         text-[var(--color-text-secondary)] transition-colors
                         hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]
                         disabled:opacity-50"
            >
              {bot.status === 'active' ? '⏸ Pause' : '▷ Activate'}
            </button>
            <button
              disabled={actionLoading}
              onClick={() => {
                if (window.confirm(`Delete "${bot.name}" and all its run history?`)) {
                  void wrap(onDelete)()
                }
              }}
              title="Delete bot"
              className="rounded-lg border border-[var(--color-danger)]/30 p-1.5 text-sm
                         text-[var(--color-danger)] transition-colors
                         hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
            >
              🗑
            </button>
          </div>
        </div>

        {/* Goal */}
        <div className="mt-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Goal
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{bot.goal}</p>
        </div>

        {/* Auth notice for cloud bots when signed out */}
        {bot.synced && !isAuthenticated && (
          <p className="mt-2 text-[10px] text-yellow-400">
            ⚠ Sign in to run this cloud bot.
          </p>
        )}

        {/* Run CTA */}
        <div className="mt-3 flex items-center gap-3">
          <button
            disabled={!canRun}
            onClick={() => { void wrap(onRun)() }}
            className="rounded-xl bg-[var(--color-accent)] px-5 py-2 text-sm font-medium
                       text-white transition-colors hover:bg-[var(--color-accent-hover)]
                       disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runLabel()}
          </button>
          {!bot.synced && isAuthenticated && (
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Sign in with a paid plan to sync &amp; run on any device.
            </p>
          )}
        </div>
      </div>

      {/* ── Run history ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Run History
            {runs.length > 0 && (
              <span className="ml-2 rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px]">
                {String(runs.length)}
              </span>
            )}
          </p>
          <button
            onClick={onRefreshRuns}
            className="text-xs text-[var(--color-accent)] transition-opacity hover:opacity-70"
          >
            ↺ Refresh
          </button>
        </div>

        {runs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center">
            <p className="text-2xl">📋</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              No runs yet. Use the Run button above to start a run.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <RunItem key={run.id} run={run} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── BotsPanel (main export) ──────────────────────────────────────────────────

interface IBotsProps {
  onSignIn: () => void
}

export function BotsPanel({ onSignIn }: IBotsProps): React.JSX.Element {
  const bots = useBotStore((s) => s.bots)
  const runs = useBotStore((s) => s.runs)
  const selectedBotId = useBotStore((s) => s.selectedBotId)
  const loading = useBotStore((s) => s.loading)
  const runningBotId = useBotStore((s) => s.runningBotId)
  const error = useBotStore((s) => s.error)
  const { user } = useAuthStore()
  const isAuthenticated = user !== null

  const [showCreate, setShowCreate] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)

  // Reload bots when auth state changes.
  useEffect(() => {
    void useBotStore.getState().loadBots()
  }, [user])

  // Auto-poll run history while a run is pending/running for the selected bot.
  useEffect(() => {
    if (!selectedBotId) return
    const botRuns = runs[selectedBotId] ?? []
    const hasActive = botRuns.some((r) => ACTIVE_STATUSES.has(r.status))
    if (!hasActive) return
    const timer = setInterval(() => { void useBotStore.getState().loadRuns(selectedBotId) }, 5_000)
    return () => { clearInterval(timer) }
  }, [runs, selectedBotId])

  const handleCreate = useCallback(
    async (name: string, description: string, goal: string): Promise<void> => {
      setCreateLoading(true)
      try {
        await useBotStore.getState().createBot({ name, description, goal })
        setShowCreate(false)
      } finally {
        setCreateLoading(false)
      }
    },
    [],
  )

  const selectedBot = bots.find((b) => b.id === selectedBotId)

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel: bot list ─────────────────────────────────────────── */}
      <div className="flex w-[220px] shrink-0 flex-col border-r border-[var(--color-border)]">
        {/* Header */}
        <div className="border-b border-[var(--color-border)] px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">My Bots</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                {String(bots.length)} bot{bots.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => { setShowCreate(true) }}
              className="flex h-7 w-7 items-center justify-center rounded-lg
                         bg-[var(--color-accent)] text-sm font-bold text-white
                         transition-colors hover:bg-[var(--color-accent-hover)]"
              title="New Bot"
            >
              +
            </button>
          </div>
        </div>

        {/* Local mode notice */}
        {!isAuthenticated && (
          <div className="border-b border-[var(--color-border)] bg-blue-500/10 px-3 py-2">
            <p className="text-[10px] leading-relaxed text-blue-300">
              Local mode — bots saved on this device.{' '}
              <button onClick={onSignIn} className="underline hover:text-blue-200">
                Sign in
              </button>{' '}
              to sync &amp; enable cloud execution.
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-danger)]/10 px-3 py-2">
            <p className="text-[10px] text-[var(--color-danger)]">{error}</p>
            <button
              onClick={() => { useBotStore.getState().clearError() }}
              className="mt-0.5 text-[10px] underline text-[var(--color-danger)]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Bot list */}
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {loading && bots.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-[var(--color-text-muted)]">
              Loading…
            </p>
          ) : bots.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <p className="text-xs text-[var(--color-text-secondary)]">No bots yet.</p>
              <button
                onClick={() => { setShowCreate(true) }}
                className="mt-2 text-xs text-[var(--color-accent)] hover:underline"
              >
                Create your first bot →
              </button>
            </div>
          ) : (
            bots.map((bot) => (
              <BotListItem
                key={bot.id}
                bot={bot}
                isSelected={selectedBotId === bot.id}
                isRunning={runningBotId === bot.id}
                onClick={() => { useBotStore.getState().selectBot(bot.id) }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: bot detail or empty state ───────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedBot ? (
          <BotDetail
            bot={selectedBot}
            runs={runs[selectedBot.id] ?? []}
            isRunning={runningBotId === selectedBot.id}
            isAuthenticated={isAuthenticated}
            onDelete={async () => { await useBotStore.getState().deleteBot(selectedBot.id) }}
            onToggleStatus={async () => { await useBotStore.getState().toggleStatus(selectedBot.id) }}
            onRun={async () => { await useBotStore.getState().runBot(selectedBot.id) }}
            onRefreshRuns={() => { void useBotStore.getState().loadRuns(selectedBot.id) }}
          />
        ) : (
          <EmptyState onCreate={() => { setShowCreate(true) }} />
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateBotModal
          loading={createLoading}
          onSubmit={handleCreate}
          onClose={() => { setShowCreate(false) }}
        />
      )}
    </div>
  )
}
