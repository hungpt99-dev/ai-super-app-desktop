/**
 * DemoBanner.tsx
 *
 * Persistent top banner shown when the app is running in demo mode.
 * Dismissible per session (stored in sessionStorage so it reappears on refresh).
 */

import React, { useState } from 'react'

export function DemoBanner(): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('demo_banner_dismissed') === '1',
  )

  if (dismissed) return null

  const handleDismiss = (): void => {
    sessionStorage.setItem('demo_banner_dismissed', '1')
    setDismissed(true)
  }

  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-between
                 bg-amber-500/10 border-b border-amber-500/30
                 px-4 py-2 text-xs"
    >
      <div className="flex items-center gap-2 text-amber-400">
        <span className="text-sm">🎭</span>
        <span>
          <strong>Demo mode</strong> — all data is simulated. No real API calls are made.
          Login with any credentials to explore.
        </span>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss demo banner"
        className="ml-4 shrink-0 rounded p-0.5 text-amber-400/70
                   transition-colors hover:bg-amber-500/20 hover:text-amber-300"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
