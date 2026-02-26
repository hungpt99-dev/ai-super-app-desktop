import React from 'react'

/**
 * HubPanel — "Agent Hub" coming-soon placeholder.
 *
 * Will be replaced with the live marketplace UI once the backend
 * marketplace service ships.
 */
export function HubPanel(): React.JSX.Element {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-[var(--color-bg)] p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--color-surface-2)] text-4xl">
        🛍️
      </div>
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Agent Hub</h2>
        <p className="mt-2 max-w-sm text-sm text-[var(--color-text-secondary)]">
          Browse, install, and manage AI modules to extend your SuperApp.
          One-click install with automatic permission review.
        </p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] px-4 py-1.5 text-sm font-semibold text-[var(--color-accent)]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
        Coming Soon
      </span>
    </div>
  )
}
