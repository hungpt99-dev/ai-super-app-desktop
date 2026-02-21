/**
 * OAuthCallbackPage.tsx — handles the redirect back from the backend after OAuth.
 *
 * The backend redirects here with:
 *   /oauth/callback?access_token=<jwt>&refresh_token=<rt>
 *
 * On success: stores the tokens, fetches the user profile, then
 * navigates to /dashboard.  On error: shows an explanatory message.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store.js'

export function OAuthCallbackPage(): React.JSX.Element {
  const navigate = useNavigate()
  const authStore = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const providerError = params.get('error')

    if (providerError) {
      setError(decodeURIComponent(providerError).replaceAll('+', ' '))
      return
    }

    if (!accessToken || !refreshToken) {
      setError('OAuth callback is missing required tokens. Please try again.')
      return
    }

    // Remove tokens from the address bar immediately to avoid leaking via
    // browser history or the Referrer header on subsequent navigations.
    window.history.replaceState({}, '', '/oauth/callback')

    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await authStore.handleOAuthCallback(accessToken, refreshToken)
        navigate('/dashboard', { replace: true })
      } catch (e: unknown) {
        setError((e as Error).message)
      }
    })()
  // Intentional empty dep array — runs once on mount (authStore and navigate
  // are stable Zustand / router references that never change).
  }, [])

  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-bg)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)]
                      bg-[var(--color-surface)] p-8 text-center shadow-2xl animate-fade-in">
        {error ? (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full
                            bg-[var(--color-danger)]/10 text-2xl mx-auto">
              ⚠️
            </div>
            <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
              Authentication failed
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{error}</p>
            <button
              onClick={() => { navigate('/login') }}
              className="mt-6 w-full rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-medium
                         text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            {/* Spinner */}
            <svg
              className="mx-auto mb-4 animate-spin text-[var(--color-accent)]"
              width="32" height="32" viewBox="0 0 24 24" fill="none"
            >
              <circle className="opacity-20" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="3" />
              <path className="opacity-90" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
              Completing sign in…
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Please wait a moment.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
