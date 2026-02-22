import React, { useEffect } from 'react'
import { useAppStore, type INotificationEntry } from '../../store/app-store.js'

// ─── Per-level dot colours ────────────────────────────────────────────────────

const LEVEL_DOT: Record<INotificationEntry['level'], string> = {
  info:    'bg-[var(--color-accent)]',
  success: 'bg-emerald-400',
  warning: 'bg-yellow-400',
  error:   'bg-red-400',
}

const LEVEL_SOURCE: Record<INotificationEntry['level'], string> = {
  info:    'text-[var(--color-accent)]',
  success: 'text-emerald-400',
  warning: 'text-yellow-400',
  error:   'text-red-400',
}

// ─── Single item ──────────────────────────────────────────────────────────────

function NotifItem({ n }: { n: INotificationEntry }): React.JSX.Element {
  const time = new Date(n.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div className="border-b border-[var(--color-border)] px-4 py-3 hover:bg-[var(--color-surface-2)] transition-colors">
      <div className="flex items-start gap-2.5">
        <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${LEVEL_DOT[n.level]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
              {n.title}
            </p>
            <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">{time}</span>
          </div>
          {n.body ? (
            <p className="mt-0.5 text-xs leading-snug text-[var(--color-text-secondary)]">
              {n.body}
            </p>
          ) : null}
          {n.source ? (
            <p className={`mt-1 text-[10px] font-medium ${LEVEL_SOURCE[n.level]}`}>
              {n.source}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface INotificationCenterProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * NotificationCenter — slide-in history panel anchored to the right of the sidebar.
 *
 * Marks all notifications as read when opened.
 * Renders as a fixed overlay on top of the main content area.
 */
export function NotificationCenter({
  isOpen,
  onClose,
}: INotificationCenterProps): React.JSX.Element | null {
  const notificationHistory = useAppStore((s) => s.notificationHistory)

  // Mark all as read whenever the panel opens
  useEffect(() => {
    if (isOpen) {
      useAppStore.getState().markAllRead()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Transparent backdrop — click outside to close */}
      <div
        className="fixed inset-0 z-40"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel — positioned to the right of the 220px sidebar */}
      <div
        role="dialog"
        aria-label="Notifications"
        className="fixed left-[220px] top-0 z-50 flex h-full w-[340px] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3.5">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Notifications
          </h2>
          <div className="flex items-center gap-3">
            {notificationHistory.length > 0 ? (
              <button
                onClick={() => { useAppStore.getState().clearHistory() }}
                className="text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
              >
                Clear all
              </button>
            ) : null}
            <button
              onClick={onClose}
              aria-label="Close notifications"
              className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notificationHistory.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-2)]">
                <svg
                  width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  className="text-[var(--color-text-muted)]"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  No notifications yet
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Bots and agents will send them here
                </p>
              </div>
            </div>
          ) : (
            notificationHistory.map((n) => <NotifItem key={n.id} n={n} />)
          )}
        </div>
      </div>
    </>
  )
}
