import React, { useEffect, useState } from 'react'
import { useAppStore, type IToastNotification } from '../store/app-store.js'

// ─── Per-level styles ────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<
  IToastNotification['level'],
  { border: string; bg: string; icon: string }
> = {
  info:    { border: 'border-[var(--color-accent)]',  bg: 'bg-[var(--color-accent-dim)]', icon: 'text-[var(--color-accent)]' },
  success: { border: 'border-emerald-800',             bg: 'bg-emerald-950/60',            icon: 'text-emerald-400' },
  warning: { border: 'border-yellow-700',              bg: 'bg-yellow-950/60',             icon: 'text-yellow-400' },
  error:   { border: 'border-red-800',                 bg: 'bg-red-950/60',                icon: 'text-red-400' },
}

const LEVEL_ICONS: Record<IToastNotification['level'], React.JSX.Element> = {
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  success: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  warning: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  error: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
}

// ─── Single toast ─────────────────────────────────────────────────────────────

function ToastItem({
  notification: n,
  onDismiss,
}: {
  notification: IToastNotification
  onDismiss: () => void
}): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  const styles = LEVEL_STYLES[n.level]

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 16)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      role="alert"
      className={[
        'pointer-events-auto flex w-80 items-start gap-3 rounded-xl border px-4 py-3 shadow-xl backdrop-blur-sm',
        'transition-all duration-300 ease-out',
        styles.border, styles.bg,
        visible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0',
      ].join(' ')}
    >
      <span className={`mt-0.5 shrink-0 ${styles.icon}`}>{LEVEL_ICONS[n.level]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-[var(--color-text-primary)]">
          {n.title}
        </p>
        {n.body && (
          <p className="mt-0.5 text-xs leading-snug text-[var(--color-text-secondary)]">{n.body}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ─── Container ────────────────────────────────────────────────────────────────

/**
 * ToastContainer — fixed overlay that renders active push notifications.
 * Mount once at the App root; reads from useAppStore.
 */
export function ToastContainer(): React.JSX.Element {
  const { notifications, dismissNotification } = useAppStore()

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col-reverse gap-2"
    >
      {notifications.map((n) => (
        <ToastItem
          key={n.id}
          notification={n}
          onDismiss={() => dismissNotification(n.id)}
        />
      ))}
    </div>
  )
}
