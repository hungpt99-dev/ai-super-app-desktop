import React from 'react'
import type { AppView } from '../store/app-store.js'

/** Views that map directly to a top-level nav item (excludes sub-views like crypto/writing-helper). */
type INavView = 'chat' | 'features' | 'store' | 'api-keys' | 'settings'

interface ISidebarProps {
  activeView: AppView
  onNavigate: (view: AppView) => void
}

const NAV_ITEMS: Array<{ id: INavView; label: string; icon: React.ReactNode }> = [
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
    id: 'features',
    label: 'Features',
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
    id: 'store',
    label: 'Store',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
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

/** Returns the matching top-level nav id for a given AppView (module sub-views map to 'features'). */
function toNavView(view: AppView): INavView {
  if (view === 'crypto' || view === 'writing-helper') return 'features'
  return view as INavView
}

/** Sidebar — purely presentational navigation component. */
export function Sidebar({ activeView, onNavigate }: ISidebarProps): React.JSX.Element {
  const currentNavView = toNavView(activeView)

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Logo / App identity */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-[18px]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white text-sm font-bold">
          ✦
        </div>
        <div>
          <p className="text-sm font-semibold leading-none text-[var(--color-text-primary)]">
            AI SuperApp
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">Your AI OS</p>
        </div>
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
              onClick={() => onNavigate(item.id)}
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

      {/* User / plan badge at bottom */}
      <div className="border-t border-[var(--color-border)] p-3">
        <div className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-dim)] text-xs font-bold text-[var(--color-accent)]">
            U
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">Free Plan</p>
            <p className="truncate text-[10px] text-[var(--color-text-secondary)]">
              Upgrade for more AI
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
