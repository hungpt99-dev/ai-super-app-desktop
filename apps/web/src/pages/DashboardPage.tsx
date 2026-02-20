/**
 * DashboardPage.tsx — overview of devices, installed apps, recent workspaces, usage.
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store.js'
import { useWorkspaceStore } from '../store/workspace-store.js'
import { statsApi, type IPlatformStats } from '../lib/api-client.js'

interface IStatCardProps {
  label: string
  value: string | number
  icon: string
  to?: string
}

function StatCard({ label, value, icon, to }: IStatCardProps): React.JSX.Element {
  const inner = (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--color-border)]
                    bg-[var(--color-surface)] p-5 transition-colors
                    hover:border-[var(--color-accent)]/40">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-2xl font-semibold text-[var(--color-text-primary)]">{value}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      </div>
    </div>
  )

  if (to) {
    return <Link to={to} className="block">{inner}</Link>
  }
  return inner
}

export function DashboardPage(): React.JSX.Element {
  const { user } = useAuthStore()
  const { workspaces, fetchWorkspaces } = useWorkspaceStore()
  const [stats, setStats] = useState<IPlatformStats | null>(null)

  useEffect(() => {
    void fetchWorkspaces()
    statsApi.get().then(setStats).catch(() => null)
  }, [fetchWorkspaces])

  const recentWorkspaces = workspaces.slice(0, 5)

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          {user?.email} · {user?.plan ?? 'free'} plan
        </p>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon="💻"
          label="Devices online"
          value={stats ? `${stats.online_devices} / ${stats.total_devices}` : '–'}
          to="/devices"
        />
        <StatCard
          icon="📦"
          label="Apps installed"
          value={stats?.total_installs ?? '–'}
          to="/marketplace"
        />
        <StatCard
          icon="🗂️"
          label="Workspaces"
          value={stats?.total_workspaces ?? workspaces.length}
          to="/workspaces"
        />
        <StatCard
          icon="🤖"
          label="Bot runs"
          value={stats?.total_bot_runs ?? '–'}
          to="/bots"
        />
      </div>

      {/* Recent workspaces */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Recent workspaces
          </h2>
          <Link
            to="/workspaces"
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            View all →
          </Link>
        </div>

        {recentWorkspaces.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">No workspaces yet.</p>
            <Link
              to="/workspaces"
              className="mt-2 inline-block text-xs text-[var(--color-accent)] hover:underline"
            >
              Create one →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentWorkspaces.map((ws) => (
              <Link
                key={ws.id}
                to={`/workspaces/${ws.id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)]
                           bg-[var(--color-surface)] px-4 py-3 transition-colors
                           hover:border-[var(--color-accent)]/40"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{ws.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {ws.app_name ?? 'No app'}
                  </p>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {new Date(ws.updated_at).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { to: '/marketplace', icon: '📦', label: 'Browse marketplace' },
          { to: '/bots', icon: '🤖', label: 'Manage bots' },
          { to: '/devices', icon: '💻', label: 'Devices' },
          { to: '/subscription', icon: '⭐', label: `${user?.plan ?? 'free'} plan` },
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
    </div>
  )
}
