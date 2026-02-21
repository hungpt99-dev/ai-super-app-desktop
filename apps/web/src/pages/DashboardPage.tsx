/**
 * DashboardPage.tsx — rich overview of devices, bots, and recent activity.
 */

import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store.js'
import { useDeviceStore } from '../store/device-store.js'
import { useBotStore } from '../store/bot-store.js'
import { botsApi, statsApi, type IBotRun, type IPlatformStats } from '../lib/api-client.js'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${String(Math.floor(diff / 60_000))}m ago`
  if (diff < 86_400_000) return `${String(Math.floor(diff / 3_600_000))}h ago`
  return new Date(iso).toLocaleDateString()
}

const PLAN_BADGE: Record<string, string> = {
  free:       'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]',
  pro:        'bg-[var(--color-accent-dim)] text-[var(--color-accent)]',
  enterprise: 'bg-purple-500/15 text-purple-400',
}

const RUN_STATUS_DOT: Record<string, string> = {
  pending:   'bg-yellow-400',
  running:   'animate-pulse bg-blue-400',
  completed: 'bg-green-400',
  failed:    'bg-red-400',
  cancelled: 'bg-[var(--color-text-muted)]',
}

const RUN_STATUS_BADGE: Record<string, string> = {
  pending:   'bg-yellow-400/15 text-yellow-400',
  running:   'bg-blue-400/15 text-blue-400',
  completed: 'bg-green-400/15 text-green-400',
  failed:    'bg-red-400/15 text-red-400',
  cancelled: 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]',
}

interface IRunEntry extends IBotRun { botName: string }

// ─── Sub-components ────────────────────────────────────────────────────────────

interface IMetricCardProps {
  icon: string
  label: string
  value: string | number
  sub?: string | undefined
  accent?: boolean
  to?: string
}

function MetricCard({ icon, label, value, sub, accent = false, to }: IMetricCardProps): React.JSX.Element {
  const inner = (
    <div className={`flex flex-col gap-2 rounded-xl border p-5 transition-colors ${
      accent
        ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-dim)]'
        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/30'
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-xl">{icon}</span>
        {to && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-[var(--color-text-muted)]">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>
      <div>
        <p className={`text-2xl font-semibold ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
          {value}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{label}</p>
        {sub !== undefined && (
          <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{sub}</p>
        )}
      </div>
    </div>
  )
  if (to) return <Link to={to} className="block">{inner}</Link>
  return inner
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { devices, fetchDevices } = useDeviceStore()
  const { bots, fetchBots } = useBotStore()
  const [stats, setStats] = useState<IPlatformStats | null>(null)
  const [recentRuns, setRecentRuns] = useState<IRunEntry[]>([])
  const [runsLoading, setRunsLoading] = useState(true)

  useEffect(() => {
    void statsApi.get().then(setStats).catch(() => null)
    void fetchDevices()
    void fetchBots()
  }, [fetchDevices, fetchBots])

  useEffect(() => {
    if (bots.length === 0) return
    setRunsLoading(true)
    void Promise.all(
      bots.slice(0, 5).map(async (bot) => {
        const runs = await botsApi.getRuns(bot.id, 5)
        return runs.map((r) => ({ ...r, botName: bot.name }))
      }),
    ).then((chunks) => {
      const sorted = chunks
        .flat()
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, 10)
      setRecentRuns(sorted)
    }).catch(() => null).finally(() => { setRunsLoading(false) })
  }, [bots])

  const onlineDevices  = devices.filter((d) => d.status === 'online')
  const offlineDevices = devices.filter((d) => d.status === 'offline')
  const activeBots     = bots.filter((b) => b.status === 'active')
  const memberSince    = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 space-y-8">

      {/* ── Hero header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Welcome back{user?.name ? `, ${user.name}` : ''}! 👋
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{user?.email}</p>
          {memberSince !== null && (
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Member since {memberSince}</p>
          )}
        </div>
        <Link
          to="/subscription"
          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${PLAN_BADGE[user?.plan ?? 'free'] ?? ''}`}
        >
          {user?.plan ?? 'free'} plan
        </Link>
      </div>

      {/* ── Metrics grid ── */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Overview
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            icon="💻"
            label="Devices online"
            value={stats ? `${String(stats.online_devices)} / ${String(stats.total_devices)}` : '–'}
            sub={stats ? `${String(stats.total_devices - stats.online_devices)} offline` : undefined}
            accent={!!stats && stats.online_devices > 0}
            to="/devices"
          />
          <MetricCard
            icon="⚙️"
            label="My bots"
            value={stats?.total_bots ?? '–'}
            sub={`${String(activeBots.length)} active`}
            to="/bots"
          />
          <MetricCard
            icon="▶️"
            label="Total runs"
            value={stats?.total_bot_runs ?? '–'}
            sub="across all bots"
            to="/bots"
          />
          <MetricCard
            icon="🛍️"
            label="Installed from store"
            value={stats?.total_installs ?? '–'}
            to="/marketplace"
          />
        </div>
      </section>

      {/* ── Devices + Bots row ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Devices */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Devices
            </p>
            <Link to="/devices" className="text-xs text-[var(--color-accent)] hover:underline">
              View all →
            </Link>
          </div>
          {devices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">No devices registered.</p>
              <Link to="/devices" className="mt-1 block text-xs text-[var(--color-accent)] hover:underline">
                Register a device →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {[...onlineDevices, ...offlineDevices].slice(0, 4).map((device) => {
                const isOnline = device.status === 'online'
                return (
                  <button
                    key={device.id}
                    onClick={() => { navigate(`/devices/${device.id}`) }}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)]
                               bg-[var(--color-surface)] px-4 py-3 text-left transition-colors
                               hover:border-[var(--color-accent)]/40"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ${
                      isOnline ? 'bg-green-400/15' : 'bg-[var(--color-surface-2)]'
                    }`}>
                      💻
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{device.name}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {device.platform} · v{device.version}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isOnline
                        ? 'bg-green-400/15 text-green-400'
                        : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                    }`}>
                      {isOnline ? '● Online' : '○ Offline'}
                    </span>
                  </button>
                )
              })}
              {devices.length > 4 && (
                <p className="text-center text-xs text-[var(--color-text-muted)]">
                  +{devices.length - 4} more ·{' '}
                  <Link to="/devices" className="text-[var(--color-accent)] hover:underline">view all</Link>
                </p>
              )}
            </div>
          )}
        </section>

        {/* My Bots */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              My Bots
            </p>
            <Link to="/bots" className="text-xs text-[var(--color-accent)] hover:underline">
              View all →
            </Link>
          </div>
          {bots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">No bots yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bots.slice(0, 4).map((bot) => (
                <button
                  key={bot.id}
                  onClick={() => { navigate(`/bots/${bot.id}`) }}
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)]
                             bg-[var(--color-surface)] px-4 py-3 text-left transition-colors
                             hover:border-[var(--color-accent)]/40"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-base">
                    🤖
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{bot.name}</p>
                    <p className="truncate text-[10px] text-[var(--color-text-muted)]">{bot.goal}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    bot.status === 'active'
                      ? 'bg-green-400/15 text-green-400'
                      : 'bg-yellow-400/15 text-yellow-400'
                  }`}>
                    {bot.status}
                  </span>
                </button>
              ))}
              {bots.length > 4 && (
                <p className="text-center text-xs text-[var(--color-text-muted)]">
                  +{bots.length - 4} more ·{' '}
                  <Link to="/bots" className="text-[var(--color-accent)] hover:underline">view all</Link>
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Recent Activity ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Recent Activity
          </p>
          <Link to="/bots" className="text-xs text-[var(--color-accent)] hover:underline">
            View all →
          </Link>
        </div>

        {runsLoading ? (
          <div className="flex h-24 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <p className="text-sm text-[var(--color-text-secondary)]">Loading activity…</p>
          </div>
        ) : recentRuns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">No runs yet. Start a bot to see activity here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)]
                           bg-[var(--color-surface)] px-4 py-3"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${RUN_STATUS_DOT[run.status] ?? ''}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{run.botName}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RUN_STATUS_BADGE[run.status] ?? ''}`}>
                      {run.status}
                    </span>
                  </div>
                  {run.result !== '' && (
                    <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{run.result}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-[var(--color-text-muted)]">{relativeTime(run.started_at)}</p>
                  {run.steps > 0 && (
                    <p className="text-[10px] text-[var(--color-text-muted)]">{run.steps} steps</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Quick links ── */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Quick Links
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { to: '/marketplace', icon: '🛍️', label: 'Bot Marketplace' },
            { to: '/bots',        icon: '⚙️', label: 'My Bots' },
            { to: '/devices',     icon: '💻', label: 'Devices' },
            { to: '/subscription',icon: '⭐', label: `${user?.plan ?? 'free'} plan` },
          ].map(({ to, icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)]
                         bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)]
                         transition-colors hover:border-[var(--color-accent)]/40"
            >
              <span>{icon}</span>
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
