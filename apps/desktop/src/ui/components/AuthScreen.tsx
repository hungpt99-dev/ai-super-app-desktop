import React, { useState } from 'react'
import { useAuthStore } from '../store/auth-store.js'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthTab = 'login' | 'register'

// ─── Shared primitives ────────────────────────────────────────────────────────

function InputField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  required = true,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</label>
      <input
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value) }}
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
      />
    </div>
  )
}

function SubmitButton({ children, loading }: { children: React.ReactNode; loading: boolean }): React.JSX.Element {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] py-3 text-sm font-semibold text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && (
        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {loading ? 'Please wait…' : children}
    </button>
  )
}

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm(): React.JSX.Element {
  const authStore = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    await authStore.login(email, password)
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
      <InputField
        label="Email address"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">Password</label>
          <button
            type="button"
            onClick={() => { setShowPassword(!showPassword) }}
            className="text-[11px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <input
          type={showPassword ? 'text' : 'password'}
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => { setPassword(e.target.value) }}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
        />
      </div>
      <SubmitButton loading={authStore.isLoading}>Sign in</SubmitButton>
    </form>
  )
}

// ─── Register form ────────────────────────────────────────────────────────────

function RegisterForm(): React.JSX.Element {
  const authStore = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setLocalError(null)
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setLocalError('Passwords do not match.')
      return
    }
    await authStore.register(email, password, name)
  }

  const error = localError ?? authStore.error

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
      <InputField
        label="Full name"
        value={name}
        onChange={setName}
        placeholder="Jane Doe"
        autoComplete="name"
      />
      <InputField
        label="Email address"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
      />
      <InputField
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="Min. 8 characters"
        autoComplete="new-password"
      />
      <InputField
        label="Confirm password"
        type="password"
        value={confirm}
        onChange={setConfirm}
        placeholder="Repeat your password"
        autoComplete="new-password"
      />
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2.5 text-xs text-red-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}
      <SubmitButton loading={authStore.isLoading}>Create account</SubmitButton>
      <p className="text-center text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        By creating an account you agree to our{' '}
        <a href="https://ai-superapp.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--color-accent)]">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="https://ai-superapp.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--color-accent)]">
          Privacy Policy
        </a>.
      </p>
    </form>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface IAuthScreenProps {
  /** Called when the user dismisses the modal. Omit to hide the button. */
  onClose?: () => void
}

/**
 * AuthScreen — login / register screen.
 * Can be used full-screen or as a modal overlay (pass `onClose` to enable dismiss).
 */
export function AuthScreen({ onClose }: IAuthScreenProps): React.JSX.Element {
  const [tab, setTab] = useState<AuthTab>('login')
  const authStore = useAuthStore()

  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--color-bg)]/80 p-4 backdrop-blur-sm">
      {/* Card */}
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-purple-600 text-3xl font-bold text-white shadow-xl">
            ✦
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">AI SuperApp</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Your real AI assistant, on your device</p>
        </div>

        {/* Card panel */}
        <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
          {onClose !== undefined ? (
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
          {/* Tabs */}
          <div className="flex border-b border-[var(--color-border)]">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t)
                  authStore.clearError()
                }}
                className={[
                  'flex-1 py-3.5 text-xs font-semibold transition-colors',
                  tab === t
                    ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
                ].join(' ')}
              >
                {t === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {/* Form area */}
          <div className="p-6">
            {/* Server-side error (login tab only — register has inline error) */}
            {tab === 'login' && authStore.error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2.5 text-xs text-red-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {authStore.error}
              </div>
            )}

            {tab === 'login' ? <LoginForm /> : <RegisterForm />}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-[var(--color-text-muted)]">
          Your data stays on your device. We never sell your information.
        </p>
      </div>
    </div>
  )
}
