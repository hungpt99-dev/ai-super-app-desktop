/**
 * RegisterPage.tsx — new account creation form.
 */

import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store.js'

export function RegisterPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { register, loading, error, clearError } = useAuthStore()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setLocalError(null)
    clearError()

    if (password !== confirm) {
      setLocalError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.')
      return
    }

    try {
      await register(email.trim(), name.trim(), password)
      navigate('/dashboard')
    } catch {
      // error surfaced via store
    }
  }

  const displayError = localError ?? error

  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-bg)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)]
                      bg-[var(--color-surface)] p-8 shadow-2xl animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mb-3 text-3xl">🤖</div>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Create account</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">AI SuperApp Platform</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Name</label>
            <input
              type="text"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Email</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Confirm password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            />
          </div>

          {displayError && (
            <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
              {displayError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-medium
                       text-white transition-colors hover:bg-[var(--color-accent-hover)]
                       disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--color-text-secondary)]">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--color-accent)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
