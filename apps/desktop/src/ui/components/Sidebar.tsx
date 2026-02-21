import React from 'react'
import type { AppView } from '../store/app-store.js'
import { useAuthStore } from '../store/auth-store.js'
import { useAgentStore } from '../store/agent-store.js'

/** Views that map directly to a top-level nav item (excludes sub-views like crypto/writing-helper). */
type INavView = 'dashboard' | 'chat' | 'bots' | 'activity' | 'logs' | 'api-keys' | 'settings'

interface ISidebarProps {
  activeView: AppView
  onNavigate: (view: AppView) => void
  unreadCount: number
  onNotifications: () => void
  onSignIn: () => void
}

const NAV_ITEMS: { id: INavView; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'bots',
    label: 'Bots',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

/** Returns the matching top-level nav id for a given AppView (module sub-views map to 'bots'). */
function toNavView(view: AppView): INavView {
  if (view === 'bot-run') return 'bots'
  return view as INavView
}

/** Sidebar — purely presentational navigation component. */
export function Sidebar({ activeView, onNavigate, unreadCount, onNotifications, onSignIn }: ISidebarProps): React.JSX.Element {
  const currentNavView = toNavView(activeView)
  const authStore = useAuthStore()
  const user = authStore.user
  const initial = user ? user.name.charAt(0).toUpperCase() : 'U'
  const agentStatus = useAgentStore((s) => s.status)
  const agentMetrics = useAgentStore((s) => s.metrics)
  const agentDeviceName = useAgentStore((s) => s.deviceName)
  const activeRunGoal = useAgentStore((s) => s.activeRunGoal)

  function formatUptime(seconds: number): string {
    if (seconds < 60) return 'just started'
    if (seconds < 3_600) return `${String(Math.floor(seconds / 60))}m uptime`
    return `${String(Math.floor(seconds / 3_600))}h ${String(Math.floor((seconds % 3_600) / 60))}m uptime`
  }

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Logo / App identity */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-[18px]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white text-sm font-bold">
          ✦
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold leading-none text-[var(--color-text-primary)]">
            AI SuperApp
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">Your AI OS</p>
        </div>
        {/* Bell button */}
        <button
          onClick={onNotifications}
          aria-label={`Notifications${unreadCount > 0 ? ` (${String(unreadCount)} unread)` : ''}`}
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : String(unreadCount)}
            </span>
          ) : null}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-3">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          Menu
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive = currentNavView === item.id
          return (
            <button
              key={item.id}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => { onNavigate(item.id) }}
              className={[
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left',
                isActive
                  ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              <span className="shrink-0">{item.icon}</span>
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Agent Status Bar */}
      <div className="border-t border-[var(--color-border)] p-3 space-y-2">
        <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {agentStatus === 'running' ? (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
              ) : agentStatus === 'idle' ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
              ) : agentStatus === 'paused' ? (
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)]" />
              )}
              <span className="text-[10px] font-medium text-[var(--color-text-secondary)] truncate max-w-[110px]">
                {agentStatus === 'running'
                  ? (activeRunGoal !== null ? activeRunGoal.slice(0, 28) + (activeRunGoal.length > 28 ? '…' : '') : 'Working…')
                  : agentStatus === 'idle' ? 'Idle'
                  : agentStatus === 'paused' ? 'Paused' : 'Offline'}
              </span>
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {agentMetrics.tasksCompleted > 0 ? `${String(agentMetrics.tasksCompleted)} done` : 'Agent'}
            </span>
          </div>
          {agentStatus !== 'offline' ? (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--color-text-muted)] truncate">
                {agentDeviceName ?? 'Desktop Agent'}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {agentMetrics.uptimeSeconds > 0 ? formatUptime(agentMetrics.uptimeSeconds) : ''}
              </span>
            </div>
          ) : null}
          {agentStatus !== 'offline' && agentMetrics.cpuPercent > 0 ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="text-[9px] text-[var(--color-text-muted)]">CPU</span>
                  <span className="text-[9px] text-[var(--color-text-muted)]">{String(agentMetrics.cpuPercent)}%</span>
                </div>
                <div className="h-1 w-full rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-1 rounded-full bg-[var(--color-accent)]"
                    style={{ width: `${String(agentMetrics.cpuPercent)}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="text-[9px] text-[var(--color-text-muted)]">MEM</span>
                  <span className="text-[9px] text-[var(--color-text-muted)]">{String(agentMetrics.memPercent)}%</span>
                </div>
                <div className="h-1 w-full rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-1 rounded-full bg-[var(--color-success)]"
                    style={{ width: `${String(agentMetrics.memPercent)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
        {user !== null ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-[var(--color-surface-2)] px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-dim)] text-xs font-bold text-[var(--color-accent)]">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">{user.name}</p>
              <p className="truncate text-[10px] text-[var(--color-text-muted)]">{user.email}</p>
            </div>
            <button
              onClick={() => { void authStore.logout() }}
              disabled={authStore.isLoading}
              title="Sign out"
              className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-red-950/50 hover:text-red-400 disabled:opacity-50"
              aria-label="Sign out"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={onSignIn}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent-dim)] px-3 py-2.5 text-xs font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Sign in
          </button>
        )}
      </div>
    </aside>
  )
}
