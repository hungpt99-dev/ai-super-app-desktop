/**
 * OAuthButtons.tsx — reusable Google / GitHub OAuth sign-in buttons.
 * Handles demo-mode simulation so pages stay unaware of the env flag.
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store.js'

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true'
const GATEWAY = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000'

// ── SVG brand icons ─────────────────────────────────────────────────────────────────────

function GoogleIcon(): React.JSX.Element {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function GitHubIcon(): React.JSX.Element {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────────

interface IOAuthButtonsProps {
  /** Extra class applied to the outer wrapper. */
  className?: string
}

/**
 * Renders "Continue with Google" + "Continue with GitHub" buttons followed by
 * an "or continue with email" divider.  Place this above the email/password form.
 */
export function OAuthButtons({ className }: IOAuthButtonsProps): React.JSX.Element {
  const navigate = useNavigate()
  const authStore = useAuthStore()

  const handleOAuth = (provider: 'google' | 'github'): void => {
    if (IS_DEMO) {
      void (async () => {
        const demoData = await import('../lib/demo/demo-data.js')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await authStore.handleOAuthCallback(demoData.DEMO_TOKEN, demoData.DEMO_REFRESH_TOKEN)
        navigate('/dashboard')
      })()
      return
    }
    const redirectUri = encodeURIComponent(`${window.location.origin}/oauth/callback`)
    window.location.href = `${GATEWAY}/v1/auth/oauth/${provider}?redirect_uri=${redirectUri}`
  }

  const btnBase =
    'flex w-full items-center justify-center gap-2.5 rounded-lg border ' +
    'border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 ' +
    'text-sm font-medium text-[var(--color-text-primary)] transition-colors ' +
    'hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)] ' +
    'disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div className={className}>
      {/* Provider buttons */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={authStore.loading}
          onClick={() => { handleOAuth('google') }}
          className={btnBase}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <button
          type="button"
          disabled={authStore.loading}
          onClick={() => { handleOAuth('github') }}
          className={btnBase}
        >
          <GitHubIcon />
          Continue with GitHub
        </button>
      </div>

      {/* Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--color-border)]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[var(--color-surface)] px-2 text-[var(--color-text-muted)]">
            or continue with email
          </span>
        </div>
      </div>
    </div>
  )
}
