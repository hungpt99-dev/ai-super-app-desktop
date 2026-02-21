/**
 * DashboardPage.tsx — overview of devices, installed bots, and activity.
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store.js'
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
  const [stats, setStats] = useState<IPlatformStats | null>(null)

  useEffect(() => {
    statsApi.get().then(setStats).catch(() => null)
  }, [])

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
          icon="🤖"
          label="Bots installed"
          value={stats?.total_installs ?? '–'}
          to="/marketplace"
        />
        <StatCard
          icon="⚙️"
          label="My bots"
          value={stats?.total_bots ?? '–'}
          to="/bots"
        />
        <StatCard
          icon="▶️"
          label="Bot runs"
          value={stats?.total_bot_runs ?? '–'}
          to="/bots"
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { to: '/marketplace', icon: '🤖', label: 'Browse Bot Marketplace' },
          { to: '/bots', icon: '⚙️', label: 'Manage my bots' },
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
