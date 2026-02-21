/**
 * BotDetailPage.tsx — shows a single bot with its activity and devices.
 *
 * Tabs:
 *   Activity — full run history, filterable by status
 *   Devices  — all registered devices with their online status
 */

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBotStore } from '../store/bot-store.js'
import { useDeviceStore } from '../store/device-store.js'
import { botsApi, type IBotRun } from '../lib/api-client.js'

// ─── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = 'activity' | 'devices'
type RunFilter = 'all' | 'pending' | 'running' | 'completed' | 'failed'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${String(Math.floor(diff / 60_000))}m ago`
  if (diff < 86_400_000) return `${String(Math.floor(diff / 3_600_000))}h ago`
  return new Date(iso).toLocaleDateString()
}

function formatDuration(start: string, end?: string): string {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1_000) return `${String(ms)}ms`
  if (ms < 60_000) return `${String(Math.round(ms / 1_000))}s`
  return `${String(Math.floor(ms / 60_000))}m ${String(Math.round((ms % 60_000) / 1_000))}s`
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active: 'text-[var(--color-success)] bg-[var(--color-success)]/10',
  paused: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10',
}

const STATUS_DOT: Record<IBotRun['status'], string> = {
  pending:   'bg-yellow-400',
  running:   'animate-pulse bg-blue-400',
  completed: 'bg-green-400',
  failed:    'bg-red-400',
  cancelled: 'bg-[var(--color-text-muted)]',
}

const STATUS_BADGE: Record<IBotRun['status'], string> = {
  pending:   'bg-yellow-400/15 text-yellow-400',
  running:   'bg-blue-400/15 text-blue-400',
  completed: 'bg-green-400/15 text-green-400',
  failed:    'bg-red-400/15 text-red-400',
  cancelled: 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]',
}

const RUN_FILTERS: { id: RunFilter; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'running',   label: 'Running' },
  { id: 'pending',   label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed',    label: 'Failed' },
]

// ─── Tab bar ───────────────────────────────────────────────────────────────────

interface ITabBarProps {
  active: ActiveTab
  activityCount: number
  devicesOnline: number
  onChange: (t: ActiveTab) => void
}

function TabBar({ active, activityCount, devicesOnline, onChange }: ITabBarProps): React.JSX.Element {
  const tabs: { id: ActiveTab; label: string; badge?: number }[] = [
    { id: 'activity', label: 'Activity', ...(activityCount > 0 ? { badge: activityCount } : {}) },
    { id: 'devices',  label: 'Devices',  ...(devicesOnline > 0 ? { badge: devicesOnline } : {}) },
  ]

  return (
    <div className="flex border-b border-[var(--color-border)]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => { onChange(t.id) }}
          className={[
            'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors',
            active === t.id
              ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
          ].join(' ')}
        >
          {t.label}
          {t.badge !== undefined ? (
            <span className="rounded-full bg-[var(--color-accent-dim)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">
              {String(t.badge)}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

// ─── Activity tab ──────────────────────────────────────────────────────────────

interface IActivityTabProps {
  runs: IBotRun[]
  loading: boolean
  onRefresh: () => void
  onStop: (runId: string) => Promise<void>
}

function ActivityTab({ runs, loading, onRefresh, onStop }: IActivityTabProps): React.JSX.Element {
  const [filter, setFilter] = useState<RunFilter>('all')
  const [stopping, setStopping] = useState<Record<string, boolean>>({})

  const filtered = filter === 'all' ? runs : runs.filter((r) => r.status === filter)

  const counts: Record<RunFilter, number> = {
    all:       runs.length,
    running:   runs.filter((r) => r.status === 'running').length,
    pending:   runs.filter((r) => r.status === 'pending').length,
    completed: runs.filter((r) => r.status === 'completed').length,
    failed:    runs.filter((r) => r.status === 'failed').length,
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RUN_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id) }}
            className={[
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === f.id
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            {f.label}
            <span className={`rounded-full px-1 text-[10px] ${filter === f.id ? 'bg-white/20' : 'bg-[var(--color-border)]'}`}>
              {String(counts[f.id])}
            </span>
          </button>
        ))}
        <button
          className="ml-auto text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
          disabled={loading}
          onClick={onRefresh}
        >
          {loading ? 'Loading…' : '↺ Refresh'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <p className="text-2xl">📋</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            No {filter === 'all' ? '' : `${filter} `}runs yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((run) => {
            const isStoppable = run.status === 'running' || run.status === 'pending'
            const isStopping = stopping[run.id] === true

            const handleStop = async (): Promise<void> => {
              setStopping((prev) => ({ ...prev, [run.id]: true }))
              try { await onStop(run.id) } finally {
                setStopping((prev) => ({ ...prev, [run.id]: false }))
              }
            }

            return (
              <div
                key={run.id}
                className="flex items-start justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[run.status]}`} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[run.status]}`}>
                        {run.status}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <span>{relativeTime(run.started_at)}</span>
                      {run.steps > 0 ? <span>· {String(run.steps)} steps</span> : null}
                      <span>· {formatDuration(run.started_at, run.ended_at)}</span>
                    </div>
                    {run.result ? (
                      <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">{run.result}</p>
                    ) : null}
                  </div>
                </div>

                <div className="ml-3 flex shrink-0 items-center gap-3">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    #{run.id.slice(0, 8)}
                  </p>
                  {isStoppable && (
                    <button
                      disabled={isStopping}
                      onClick={() => void handleStop()}
                      className="flex items-center gap-1 rounded-lg border border-[var(--color-danger)]/40
                                 bg-[var(--color-danger)]/10 px-2.5 py-1 text-[11px] font-medium
                                 text-[var(--color-danger)] transition-colors
                                 hover:bg-[var(--color-danger)]/20 disabled:opacity-50"
                    >
                      {isStopping ? 'Stopping…' : '⏹ Stop'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Devices tab ───────────────────────────────────────────────────────────────

interface IDevicesTabProps {
  devices: { id: string; name: string; platform: string; version: string; status: string; last_seen_at: string | null }[]
  loading: boolean
  activeRuns: IBotRun[]
  onStart: () => Promise<void>
  onStop: (runId: string) => Promise<void>
}

function DevicesTab({ devices, loading, activeRuns, onStart, onStop }: IDevicesTabProps): React.JSX.Element {
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  const setLoading = (key: string, val: boolean): void => {
    setActionLoading((prev) => ({ ...prev, [key]: val }))
  }

  const handleStart = async (deviceId: string): Promise<void> => {
    setLoading(deviceId, true)
    try { await onStart() } finally { setLoading(deviceId, false) }
  }

  const handleStop = async (runId: string): Promise<void> => {
    setLoading(runId, true)
    try { await onStop(runId) } finally { setLoading(runId, false) }
  }

  const hasActiveRun = activeRuns.length > 0

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Loading devices…
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
        <p className="text-2xl">💻</p>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No devices registered yet.</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Install the Desktop Agent and connect a device to run bots.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {devices.map((device) => {
        const isOnline = device.status === 'online'
        const lastSeenText = device.last_seen_at ? relativeTime(device.last_seen_at) : 'never'
        const activeRun = activeRuns[0]
        return (
          <div
            key={device.id}
            className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
              isOnline ? 'bg-green-400/15' : 'bg-[var(--color-surface-2)]'
            }`}>
              💻
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{device.name}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  isOnline
                    ? 'bg-green-400/15 text-green-400'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                }`}>
                  {isOnline ? '● Online' : '○ Offline'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {device.platform} · v{device.version} · last seen {lastSeenText}
              </p>
            </div>
            {isOnline ? (
              <div className="flex shrink-0 items-center gap-2">
                {hasActiveRun && activeRun !== undefined ? (
                  <button
                    disabled={actionLoading[activeRun.id] === true}
                    onClick={() => void handleStop(activeRun.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--color-danger)]/40
                               bg-[var(--color-danger)]/10 px-3 py-1.5 text-xs font-medium
                               text-[var(--color-danger)] transition-colors
                               hover:bg-[var(--color-danger)]/20 disabled:opacity-50"
                  >
                    {actionLoading[activeRun.id] === true ? 'Stopping…' : '⏹ Stop'}
                  </button>
                ) : (
                  <button
                    disabled={actionLoading[device.id] === true}
                    onClick={() => void handleStart(device.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5
                               text-xs font-medium text-white transition-colors
                               hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
                  >
                    {actionLoading[device.id] === true ? 'Starting…' : '▶ Start'}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function BotDetailPage(): React.JSX.Element {
  const { botId } = useParams<{ botId: string }>()
  const navigate = useNavigate()

  const { bots, runs, fetchBots, fetchRuns, startBot, deleteBot, watchRuns } = useBotStore()
  const { devices, loading: devicesLoading, fetchDevices } = useDeviceStore()

  const [activeTab, setActiveTab] = useState<ActiveTab>('activity')
  const [runLoading, setRunLoading] = useState(false)

  const bot = bots.find((b) => b.id === botId)
  const botRuns = (botId ? runs[botId] : undefined) ?? []

  useEffect(() => {
    if (bots.length === 0) void fetchBots()
  }, [bots.length, fetchBots])

  useEffect(() => {
    if (!botId) return
    setRunLoading(true)
    void fetchRuns(botId).finally(() => { setRunLoading(false) })
  }, [botId, fetchRuns])

  // Auto-refresh every 5 s while any run is pending or running.
  useEffect(() => {
    if (!botId) return
    const cancel = watchRuns(botId)
    return cancel
  }, [botId, watchRuns])

  useEffect(() => {
    void fetchDevices()
  }, [fetchDevices])

  const handleDelete = async (): Promise<void> => {
    if (!botId) return
    if (!window.confirm('Delete this bot and all its run history?')) return
    await deleteBot(botId)
    navigate('/bots')
  }

  const handleRefreshRuns = (): void => {
    if (!botId) return
    setRunLoading(true)
    void fetchRuns(botId).finally(() => { setRunLoading(false) })
  }

  const handleStart = async (): Promise<void> => {
    if (!botId) return
    await startBot(botId)
    handleRefreshRuns()
  }

  const handleStop = async (runId: string): Promise<void> => {
    await botsApi.updateRun(runId, 'failed', 0, 'Stopped by user')
    handleRefreshRuns()
  }

  if (!bot) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-secondary)]">
        {bots.length === 0 ? 'Loading…' : 'Bot not found.'}
      </div>
    )
  }

  const activeRunCount = botRuns.filter((r) => r.status === 'running' || r.status === 'pending').length
  const onlineDeviceCount = devices.filter((d) => d.status === 'online').length

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-4">
        <button
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          onClick={() => { navigate('/bots') }}
        >
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-[var(--color-text-primary)]">
              {bot.name}
            </h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[bot.status] ?? ''}`}>
              {bot.status}
            </span>
          </div>
          {bot.description && (
            <p className="truncate text-xs text-[var(--color-text-secondary)]">{bot.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium
                       text-[var(--color-text-secondary)] transition-colors
                       hover:border-[var(--color-danger)]/50 hover:text-[var(--color-danger)]"
            onClick={() => void handleDelete()}
          >
            🗑
          </button>
        </div>
      </div>

      {/* Goal summary */}
      <div className="border-b border-[var(--color-border)] px-6 py-3">
        <p className="line-clamp-2 text-xs text-[var(--color-text-secondary)]">{bot.goal}</p>
      </div>

      {/* Tab bar */}
      <TabBar
        active={activeTab}
        activityCount={activeRunCount}
        devicesOnline={onlineDeviceCount}
        onChange={setActiveTab}
      />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'activity' && (
          <ActivityTab
            runs={botRuns}
            loading={runLoading}
            onRefresh={handleRefreshRuns}
            onStop={handleStop}
          />
        )}

        {activeTab === 'devices' && (
          <DevicesTab
            devices={devices}
            loading={devicesLoading}
            activeRuns={botRuns.filter((r) => r.status === 'running' || r.status === 'pending')}
            onStart={handleStart}
            onStop={handleStop}
          />
        )}
      </div>
    </div>
  )
}
