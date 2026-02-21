/**
 * MachineDetailPage.tsx
 *
 * Web Control Tower — remote monitoring and dispatch view for a single
 * registered Desktop Agent machine.
 *
 * Tabs:
 *   Overview  — device card, metrics, active run banner, dispatch
 *   Activity  — full run feed filterable by status, auto-refreshed every 10 s
 *   Info      — technical device details, bot roster
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  botsApi,
  devicesApi,
  marketplaceApi,
  type IBot,
  type IBotRun,
  type IDevice,
  type IDeviceMetrics,
  type IMarketplaceBot,
} from '../lib/api-client.js'
import { BotPanel } from '../components/bots/BotPanel.js'
import { useDeviceStore } from '../store/device-store.js'

// ─── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = 'overview' | 'activity' | 'bots' | 'info'
type RunFilter = 'all' | 'pending' | 'running' | 'completed' | 'failed'

interface IRunEntry extends IBotRun {
  botName: string
}

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

// ─── Shared sub-components ─────────────────────────────────────────────────────

interface IStatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

function StatCard({ label, value, sub, accent = false }: IStatCardProps): React.JSX.Element {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border p-4 ${
        accent
          ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-dim)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
      }`}
    >
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p
        className={`text-2xl font-semibold ${
          accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
        }`}
      >
        {value}
      </p>
      {sub !== undefined ? (
        <p className="text-[10px] text-[var(--color-text-muted)]">{sub}</p>
      ) : null}
    </div>
  )
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

interface IRunRowProps { run: IRunEntry; compact?: boolean }

function RunRow({ run, compact = false }: IRunRowProps): React.JSX.Element {
  return (
    <div className="flex items-start justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-1.5 shrink-0 h-2 w-2 rounded-full ${STATUS_DOT[run.status]}`} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{run.botName}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[run.status]}`}>
              {run.status}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span>{relativeTime(run.started_at)}</span>
            {run.steps > 0 ? <span>· {String(run.steps)} steps</span> : null}
            {!compact ? <span>· {formatDuration(run.started_at, run.ended_at)}</span> : null}
          </div>
          {!compact && run.result ? (
            <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">{run.result}</p>
          ) : null}
        </div>
      </div>
      {compact && run.result ? (
        <p className="ml-3 mt-0.5 max-w-[160px] shrink-0 truncate text-xs text-[var(--color-text-muted)]">
          {run.result}
        </p>
      ) : null}
    </div>
  )
}

// ─── Tab bar ───────────────────────────────────────────────────────────────────

interface ITabBarProps {
  tabs: { id: ActiveTab; label: string; badge?: number }[]
  active: ActiveTab
  onChange: (t: ActiveTab) => void
}

function TabBar({ tabs, active, onChange }: ITabBarProps): React.JSX.Element {
  return (
    <div className="mb-6 flex border-b border-[var(--color-border)]">
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
          {t.badge !== undefined && t.badge > 0 ? (
            <span className="rounded-full bg-[var(--color-accent-dim)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">
              {String(t.badge)}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

// ─── Overview tab ──────────────────────────────────────────────────────────────

interface IOverviewTabProps {
  device: IDevice
  runs: IRunEntry[]
  bots: IBot[]
  metrics: IDeviceMetrics | null
  selectedBotId: string
  dispatching: boolean
  heartbeating: boolean
  refreshedAt: number
  error: string | null
  onSelectBot: (id: string) => void
  onDispatch: () => void
  onHeartbeat: () => void
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${String(seconds)}s`
  if (seconds < 3_600) return `${String(Math.floor(seconds / 60))}m`
  return `${String(Math.floor(seconds / 3_600))}h ${String(Math.floor((seconds % 3_600) / 60))}m`
}

function OverviewTab({
  device, runs, bots, metrics, selectedBotId, dispatching, heartbeating,
  refreshedAt, error, onSelectBot, onDispatch, onHeartbeat,
}: IOverviewTabProps): React.JSX.Element {
  const navigate = useNavigate()
  const isOnline = device.status === 'online'
  const totalRuns = runs.length
  const completedRuns = runs.filter((r) => r.status === 'completed').length
  const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0
  const activeRun = runs.find((r) => r.status === 'running' || r.status === 'pending')
  const lastSeenText = device.last_seen_at ? relativeTime(device.last_seen_at) : 'never'
  const recentRuns = runs.slice(0, 5)

  return (
    <>
      {error !== null ? (
        <p className="mb-4 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${isOnline ? 'bg-green-400/15' : 'bg-[var(--color-surface-2)]'}`}>
            💻
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{device.name}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isOnline ? 'bg-green-400/15 text-green-400' : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
              }`}>
                {isOnline ? '● Online' : '○ Offline'}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{device.platform} · v{device.version}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Last seen {lastSeenText}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onHeartbeat}
            disabled={heartbeating}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            {heartbeating ? 'Pinging…' : '↺ Ping'}
          </button>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            refreshed {relativeTime(new Date(refreshedAt).toISOString())}
          </span>
        </div>
      </div>

      {activeRun !== undefined ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400 shrink-0" />
          <p className="text-sm text-blue-300">
            <span className="font-semibold">{activeRun.botName}</span>
            {' is '}{activeRun.status}
            {activeRun.steps > 0 ? ` — step ${String(activeRun.steps)}` : ''}
          </p>
        </div>
      ) : null}

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Agent" value={isOnline ? 'Online' : 'Offline'} sub={`Seen ${lastSeenText}`} accent={isOnline} />
        <StatCard label="Total runs" value={totalRuns} sub="across all bots" />
        <StatCard label="Completed" value={completedRuns} sub={`${String(successRate)}% success`} />
        <StatCard label="Failed" value={runs.filter((r) => r.status === 'failed').length} sub="requires attention" />
      </div>

      {metrics !== null ? (
        <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Live Metrics
            {metrics.updated_at !== null ? (
              <span className="ml-2 font-normal normal-case tracking-normal text-[var(--color-text-muted)]/60">
                · updated {relativeTime(metrics.updated_at)}
              </span>
            ) : null}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">CPU</span>
                <span className="font-medium text-[var(--color-text-primary)]">{String(Math.round(metrics.cpu_percent))}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--color-border)]">
                <div className="h-1.5 rounded-full bg-[var(--color-accent)]" style={{ width: `${String(metrics.cpu_percent)}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Memory</span>
                <span className="font-medium text-[var(--color-text-primary)]">{String(Math.round(metrics.mem_percent))}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--color-border)]">
                <div className="h-1.5 rounded-full bg-green-400" style={{ width: `${String(metrics.mem_percent)}%` }} />
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-[var(--color-text-muted)]">Uptime</span>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{formatUptime(Number(metrics.uptime_seconds))}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-[var(--color-text-muted)]">Tasks done</span>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{String(metrics.tasks_done)}</span>
            </div>
          </div>
        </div>
      ) : isOnline ? (
        <div className="mb-6 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-text-muted)]">
          Waiting for first metrics report from agent…
        </div>
      ) : null}

      {bots.length > 0 ? (
        <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">▶ Dispatch Job</h3>
          <p className="mb-4 text-xs text-[var(--color-text-muted)]">
            Queue a bot run — any online agent will claim and execute it automatically.
          </p>
          <div className="flex items-center gap-3">
            <select
              value={selectedBotId}
              onChange={(e) => { onSelectBot(e.target.value) }}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
            >
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}{bot.status === 'paused' ? ' (paused)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={onDispatch}
              disabled={dispatching || selectedBotId === ''}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {dispatching ? 'Queuing…' : 'Run Now'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-dashed border-[var(--color-border)] p-5 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No bots configured.</p>
          <button onClick={() => { navigate('/bots') }} className="mt-1 text-xs text-[var(--color-accent)] hover:underline">
            Create a bot →
          </button>
        </div>
      )}

      {recentRuns.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Recent Activity</p>
          <div className="space-y-2">
            {recentRuns.map((r) => <RunRow key={r.id} run={r} compact />)}
          </div>
        </div>
      ) : null}
    </>
  )
}

// ─── Activity tab ──────────────────────────────────────────────────────────────

interface IActivityTabProps {
  runs: IRunEntry[]
  refreshedAt: number
}

const RUN_FILTERS: { id: RunFilter; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'running',   label: 'Running' },
  { id: 'pending',   label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed',    label: 'Failed' },
]

function ActivityTab({ runs, refreshedAt }: IActivityTabProps): React.JSX.Element {
  const [filter, setFilter] = useState<RunFilter>('all')

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
        <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
          auto-refresh · {relativeTime(new Date(refreshedAt).toISOString())}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <p className="text-2xl">📋</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            No {filter === 'all' ? '' : filter} runs yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => <RunRow key={r.id} run={r} />)}
        </div>
      )}
    </>
  )
}

// ─── Info tab ──────────────────────────────────────────────────────────────────

interface IInfoTabProps {
  device: IDevice
  runs: IRunEntry[]
  bots: IBot[]
}

function InfoTab({ device, runs, bots }: IInfoTabProps): React.JSX.Element {
  const botRunCounts: Record<string, number> = {}
  for (const r of runs) {
    botRunCounts[r.botName] = (botRunCounts[r.botName] ?? 0) + 1
  }

  const deviceFields = [
    { label: 'Device ID',     value: device.id },
    { label: 'Name',          value: device.name },
    { label: 'Platform',      value: device.platform },
    { label: 'Agent Version', value: `v${device.version}` },
    { label: 'Status',        value: device.status === 'online' ? '● Online' : '○ Offline', highlight: true },
  ]

  const timeFields = [
    { label: 'Registered',     value: new Date(device.registered_at).toLocaleString() },
    { label: 'Last Heartbeat', value: device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Never' },
  ]

  return (
    <div className="space-y-6">
      <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="px-5 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Device Identity</p>
        </div>
        {deviceFields.map(({ label, value, highlight }) => (
          <div key={label} className="flex items-center justify-between px-5 py-3">
            <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
            <span className={`font-mono text-xs ${
              highlight === true
                ? device.status === 'online' ? 'text-green-400' : 'text-[var(--color-text-muted)]'
                : 'text-[var(--color-text-primary)]'
            }`}>{value}</span>
          </div>
        ))}
      </div>

      <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="px-5 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Timestamps</p>
        </div>
        {timeFields.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-5 py-3">
            <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
            <span className="text-xs text-[var(--color-text-primary)]">{value}</span>
          </div>
        ))}
      </div>

      {bots.length > 0 ? (
        <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="px-5 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Configured Bots ({String(bots.length)})
            </p>
          </div>
          {bots.map((bot) => (
            <div key={bot.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-xs font-medium text-[var(--color-text-primary)]">{bot.name}</p>
                <p className="max-w-[200px] truncate text-[10px] text-[var(--color-text-muted)]">{bot.goal}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  bot.status === 'active'
                    ? 'bg-green-400/15 text-green-400'
                    : 'bg-yellow-400/15 text-yellow-400'
                }`}>
                  {bot.status}
                </span>
                {(botRunCounts[bot.name] ?? 0) > 0 ? (
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {String(botRunCounts[bot.name])} runs
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ─── Bots tab ──────────────────────────────────────────────────────────────────

interface IBotsTabProps {
  installedBots: IMarketplaceBot[]
  workerBots: IBot[]
  selectedBot: IMarketplaceBot | null
  onSelectBot: (bot: IMarketplaceBot | null) => void
}

function BotsTab({ installedBots, workerBots, selectedBot, onSelectBot }: IBotsTabProps): React.JSX.Element {
  if (selectedBot !== null) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <BotPanel
          bot={selectedBot}
          workerBots={workerBots}
          onBack={() => { onSelectBot(null) }}
        />
      </div>
    )
  }

  if (installedBots.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <span className="text-4xl">🤖</span>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">No bots installed on this device</p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Browse the Bot Marketplace to find and install bots.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
      {installedBots.map((bot) => (
        <button
          key={bot.id}
          onClick={() => { onSelectBot(bot) }}
          className="flex items-center gap-4 rounded-xl border border-[var(--color-border)]
                     bg-[var(--color-surface)] px-5 py-4 text-left transition-colors
                     hover:border-[var(--color-accent)]/40"
        >
          {bot.icon_url !== undefined ? (
            <img src={bot.icon_url} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-xl">
              🤖
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{bot.name}</p>
            <p className="truncate text-xs text-[var(--color-text-secondary)]">{bot.description}</p>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0 text-[var(--color-text-muted)]"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function MachineDetailPage(): React.JSX.Element {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const { devices } = useDeviceStore()

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [bots, setBots] = useState<IBot[]>([])
  const [runs, setRuns] = useState<IRunEntry[]>([])
  const [metrics, setMetrics] = useState<IDeviceMetrics | null>(null)
  const [installedBots, setInstalledBots] = useState<IMarketplaceBot[]>([])
  const [selectedMarketplaceBot, setSelectedMarketplaceBot] = useState<IMarketplaceBot | null>(null)
  const [selectedBotId, setSelectedBotId] = useState<string>('')
  const [dispatching, setDispatching] = useState(false)
  const [heartbeating, setHeartbeating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState(Date.now())

  const device = devices.find((d) => d.id === deviceId)

  const loadRuns = useCallback(async (botList: IBot[]): Promise<void> => {
    const chunks = await Promise.all(
      botList.slice(0, 10).map(async (bot) => {
        const botRuns = await botsApi.getRuns(bot.id, 10)
        return botRuns.map((r) => ({ ...r, botName: bot.name }))
      }),
    )
    const sorted = chunks
      .flat()
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 50)
    setRuns(sorted)
  }, [])

  useEffect(() => {
    const init = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        await useDeviceStore.getState().fetchDevices()
        const [botList, marketplaceBots] = await Promise.all([
          botsApi.list(),
          marketplaceApi.getInstalled().catch(() => [] as IMarketplaceBot[]),
        ])
        setBots(botList)
        setInstalledBots(marketplaceBots)
        if (botList.length > 0 && botList[0] !== undefined) {
          setSelectedBotId(botList[0].id)
        }
        await loadRuns(botList)
        if (deviceId !== undefined) {
          const m = await devicesApi.getMetrics(deviceId)
          setMetrics(m)
        }
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [loadRuns, deviceId])

  // Auto-refresh runs + metrics every 10 s
  useEffect(() => {
    if (bots.length === 0) return
    const handle = setInterval(() => {
      void loadRuns(bots).then(() => { setRefreshedAt(Date.now()) })
      if (deviceId !== undefined) {
        void devicesApi.getMetrics(deviceId).then((m) => { if (m !== null) setMetrics(m) })
      }
    }, 10_000)
    return () => { clearInterval(handle) }
  }, [bots, loadRuns, deviceId])

  const handleHeartbeat = async (): Promise<void> => {
    if (deviceId === undefined) return
    setHeartbeating(true)
    try {
      await devicesApi.heartbeat(deviceId)
      await useDeviceStore.getState().fetchDevices()
    } finally {
      setHeartbeating(false)
    }
  }

  const handleDispatch = async (): Promise<void> => {
    if (selectedBotId === '') return
    setDispatching(true)
    setError(null)
    try {
      await botsApi.start(selectedBotId)
      await loadRuns(bots)
      setRefreshedAt(Date.now())
      setActiveTab('activity')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDispatching(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading machine data…</p>
      </div>
    )
  }

  if (!device) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-[var(--color-text-secondary)]">Device not found.</p>
        <button
          onClick={() => { navigate('/devices') }}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          ← Back to Devices
        </button>
      </div>
    )
  }

  const activeRunCount = runs.filter((r) => r.status === 'running' || r.status === 'pending').length

  const tabs: { id: ActiveTab; label: string; badge?: number }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'activity',  label: 'Activity', ...(activeRunCount > 0 ? { badge: activeRunCount } : {}) },
    { id: 'bots',      label: 'Bots', ...(installedBots.length > 0 ? { badge: installedBots.length } : {}) },
    { id: 'info',      label: 'Info' },
  ]

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">

      {/* Breadcrumb header */}
      <div className="mb-5 flex items-center gap-2">
        <button
          onClick={() => { navigate('/devices') }}
          className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Devices
        </button>
        <span className="text-[var(--color-text-muted)]">/</span>
        <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">{device.name}</h1>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          device.status === 'online'
            ? 'bg-green-400/15 text-green-400'
            : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
        }`}>
          {device.status === 'online' ? '● Online' : '○ Offline'}
        </span>
      </div>

      {/* Tab bar */}
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          device={device}
          runs={runs}
          bots={bots}
          metrics={metrics}
          selectedBotId={selectedBotId}
          dispatching={dispatching}
          heartbeating={heartbeating}
          refreshedAt={refreshedAt}
          error={error}
          onSelectBot={setSelectedBotId}
          onDispatch={() => { void handleDispatch() }}
          onHeartbeat={() => { void handleHeartbeat() }}
        />
      )}

      {activeTab === 'activity' && (
        <ActivityTab runs={runs} refreshedAt={refreshedAt} />
      )}

      {activeTab === 'bots' && (
        <BotsTab
          installedBots={installedBots}
          workerBots={bots}
          selectedBot={selectedMarketplaceBot}
          onSelectBot={setSelectedMarketplaceBot}
        />
      )}

      {activeTab === 'info' && (
        <InfoTab device={device} runs={runs} bots={bots} />
      )}
    </div>
  )
}
