/**
 * LoginPage.tsx — email / password login form.
 */

import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store.js'
import { OAuthButtons } from '../components/OAuthButtons.js'

export function LoginPage(): React.JSX.Element {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const clearError = useAuthStore((s) => s.clearError)
  const { loading, error } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    clearError()
    try {
      await login(email.trim(), password)
      navigate('/dashboard')
    } catch {
      // error surfaced via store
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-bg)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)]
                      bg-[var(--color-surface)] p-8 shadow-2xl animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mb-3 text-3xl">🤖</div>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Sign in</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">AI SuperApp Platform</p>
        </div>

        <OAuthButtons />

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Email</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value) }}
              autoComplete="email"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value) }}
              autoComplete="current-password"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-medium
                       text-white transition-colors hover:bg-[var(--color-accent-hover)]
                       disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--color-text-secondary)]">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-[var(--color-accent)] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
