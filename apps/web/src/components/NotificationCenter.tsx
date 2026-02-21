/**
 * NotificationCenter.tsx — web dashboard notification history panel.
 *
 * A floating panel anchored to the top-right of the sidebar.
 * Opens when the bell icon in the nav is clicked.
 */

import React, { useEffect, useRef } from 'react'
import {
  useNotificationStore,
  type IWebNotification,
} from '../store/notification-store.js'

// ─── Per-level colours ────────────────────────────────────────────────────────

const LEVEL_DOT: Record<IWebNotification['level'], string> = {
  info:    'bg-[var(--color-accent)]',
  success: 'bg-emerald-400',
  warning: 'bg-yellow-400',
  error:   'bg-red-400',
}

const LEVEL_SOURCE: Record<IWebNotification['level'], string> = {
  info:    'text-[var(--color-accent)]',
  success: 'text-emerald-400',
  warning: 'text-yellow-400',
  error:   'text-red-400',
}

// ─── Single item ──────────────────────────────────────────────────────────────

function NotifItem({ n }: { n: IWebNotification }): React.JSX.Element {
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
            <p className="mt-0.5 text-xs leading-snug text-[var(--color-text-secondary)]">{n.body}</p>
          ) : null}
          {n.source ? (
            <p className={`mt-1 text-[10px] font-medium ${LEVEL_SOURCE[n.level]}`}>{n.source}</p>
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
  /** Horizontal offset of the anchor (sidebar width). Used to position the panel. */
  anchorLeft?: number
}

/**
 * WebNotificationCenter — dropdown panel attached to the bell icon.
 *
 * Marks all notifications as read when it opens.
 * Closes when clicking outside.
 */
export function WebNotificationCenter({
  isOpen,
  onClose,
  anchorLeft = 220,
}: INotificationCenterProps): React.JSX.Element | null {
  const history = useNotificationStore((s) => s.history)
  const panelRef = useRef<HTMLDivElement>(null)

  // Mark all as read when opened
  useEffect(() => {
    if (isOpen) {
      useNotificationStore.getState().markAllRead()
    }
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent): void => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => { document.removeEventListener('mousedown', handleClick) }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      style={{ left: anchorLeft }}
      className="fixed top-0 z-50 flex h-full w-[340px] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3.5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Notifications</h2>
        <div className="flex items-center gap-3">
          {history.length > 0 ? (
            <button
              onClick={() => { useNotificationStore.getState().clearHistory() }}
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
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
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
                Agents and bots will send them here
              </p>
            </div>
          </div>
        ) : (
          history.map((n) => <NotifItem key={n.id} n={n} />)
        )}
      </div>
    </div>
  )
}
