/**
 * SettingsPage.tsx — account settings: change password, active sessions, danger zone.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store.js'

// ── Section wrapper ───────────────────────────────────────────────────────────

interface ISectionProps {
  title: string
  description: string
  children: React.ReactNode
  danger?: boolean
}

function Section({ title, description, children, danger }: ISectionProps): React.JSX.Element {
  return (
    <div
      className={`rounded-xl border p-5 ${
        danger
          ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
      }`}
    >
      <h2 className={`mb-0.5 text-sm font-semibold ${danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}>
        {title}
      </h2>
      <p className="mb-4 text-xs text-[var(--color-text-secondary)]">{description}</p>
      {children}
    </div>
  )
}

// ── Change Password ───────────────────────────────────────────────────────────

function ChangePasswordForm(): React.JSX.Element {
  const changePassword = useAuthStore((s) => s.changePassword)
  const { loading } = useAuthStore()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (next !== confirm) {
      setError('New passwords do not match.')
      return
    }
    if (next.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }

    try {
      await changePassword(current, next)
      setSuccess(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3 max-w-sm">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">Current password</label>
        <input
          type="password"
          required
          value={current}
          onChange={(e) => { setCurrent(e.target.value) }}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                     px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                     focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">New password</label>
        <input
          type="password"
          required
          placeholder="Min. 8 characters"
          value={next}
          onChange={(e) => { setNext(e.target.value) }}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                     px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                     focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">Confirm new password</label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value) }}
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
      {success && (
        <p className="rounded-lg bg-green-400/10 px-3 py-2 text-xs text-green-400">
          Password changed successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="self-start rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-medium
                   text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
      >
        {loading ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SettingsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const logoutAll = useAuthStore((s) => s.logoutAll)
  const deleteAccount = useAuthStore((s) => s.deleteAccount)
  const { user } = useAuthStore()

  const [logoutBusy, setLogoutBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const handleLogoutAll = async (): Promise<void> => {
    if (!window.confirm('Sign out all devices? You will be redirected to the login page.')) return
    setLogoutBusy(true)
    try {
      await logoutAll()
      navigate('/login')
    } finally {
      setLogoutBusy(false)
    }
  }

  const handleDeleteAccount = async (): Promise<void> => {
    if (deleteConfirm !== 'DELETE') return
    setDeleteBusy(true)
    try {
      await deleteAccount()
      navigate('/login')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Settings</h1>
        {user && (
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            {user.name} · {user.email} · {user.plan} plan
          </p>
        )}
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Change password */}
        <Section
          title="Change password"
          description="Update the password used to sign in to your account."
        >
          <ChangePasswordForm />
        </Section>

        {/* Active sessions */}
        <Section
          title="Active sessions"
          description="Sign out from all devices and browsers simultaneously."
        >
          <button
            onClick={() => void handleLogoutAll()}
            disabled={logoutBusy}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm
                       text-[var(--color-text-primary)] transition-colors
                       hover:bg-[var(--color-surface-2)] disabled:opacity-50"
          >
            {logoutBusy ? 'Signing out…' : 'Sign out all sessions'}
          </button>
        </Section>

        {/* Danger zone */}
        <Section
          title="Danger zone"
          description="Permanently delete your account and all associated data. This cannot be undone."
          danger
        >
          <div className="flex flex-col gap-3 max-w-sm">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Type <strong className="text-[var(--color-text-primary)]">DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              placeholder="DELETE"
              value={deleteConfirm}
              onChange={(e) => { setDeleteConfirm(e.target.value) }}
              className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-danger)]"
            />
            <button
              onClick={() => void handleDeleteAccount()}
              disabled={deleteBusy || deleteConfirm !== 'DELETE'}
              className="self-start rounded-lg bg-[var(--color-danger)] px-5 py-2 text-sm
                         font-medium text-white transition-opacity
                         hover:opacity-90 disabled:opacity-40"
            >
              {deleteBusy ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}
