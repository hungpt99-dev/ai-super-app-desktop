/**
 * APIKeysPanel.tsx — local BYOK key management for the desktop app.
 *
 * Keys are stored on-device (OS keychain in production, localStorage in dev).
 * They are NEVER sent to the cloud backend.
 */

import React, { useCallback, useEffect, useState } from 'react'
import {
  deleteAPIKey,
  listAPIKeys,
  saveAPIKey,
  setAPIKeyActive,
  type ILocalAPIKey,
} from '../../sdk/api-key-store.js'

const PROVIDERS = [
  { value: 'openai',    label: 'OpenAI',        icon: '🤖', placeholder: 'sk-…' },
  { value: 'anthropic', label: 'Anthropic',      icon: '🧠', placeholder: 'sk-ant-…' },
  { value: 'google',    label: 'Google Gemini',  icon: '✨', placeholder: 'AIza…' },
  { value: 'mistral',   label: 'Mistral AI',     icon: '💨', placeholder: 'key…' },
  { value: 'cohere',    label: 'Cohere',         icon: '🔮', placeholder: 'key…' },
  { value: 'groq',      label: 'Groq',           icon: '⚡', placeholder: 'gsk_…' },
]

// ── Add Key Form ──────────────────────────────────────────────────────────────

interface IAddFormProps {
  existingProviders: string[]
  onSaved: (key: ILocalAPIKey) => void
  onCancel: () => void
}

function AddKeyForm({ existingProviders, onSaved, onCancel }: IAddFormProps): React.JSX.Element {
  const [provider, setProvider] = useState('')
  const [label, setLabel] = useState('')
  const [rawKey, setRawKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = PROVIDERS.find((p) => p.value === provider)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!provider || !rawKey.trim()) return
    setBusy(true)
    setError(null)
    try {
      const saved = await saveAPIKey(provider, rawKey.trim(), label.trim())
      onSaved(saved)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        Add API key
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-[var(--color-text-secondary)]">Provider</label>
        <select
          required
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                     px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                     focus:border-[var(--color-accent)]"
        >
          <option value="">Select provider…</option>
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.icon} {p.label}{existingProviders.includes(p.value) ? ' (replace)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-[var(--color-text-secondary)]">
          Label <span className="text-[var(--color-text-muted)]">(optional)</span>
        </label>
        <input
          type="text"
          maxLength={200}
          placeholder="e.g. personal"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                     px-3 py-2 text-sm text-[var(--color-text-primary)]
                     placeholder:text-[var(--color-text-muted)] outline-none
                     focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-[var(--color-text-secondary)]">Key</label>
        <input
          type="password"
          required
          autoComplete="off"
          placeholder={selected?.placeholder ?? 'Paste your key…'}
          value={rawKey}
          onChange={(e) => setRawKey(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                     px-3 py-2 text-sm text-[var(--color-text-primary)]
                     placeholder:text-[var(--color-text-muted)] outline-none
                     focus:border-[var(--color-accent)]"
        />
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Stored locally on this device only — never sent to the cloud.
        </p>
      </div>

      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !provider || !rawKey.trim()}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white
                     transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save key'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs
                     text-[var(--color-text-secondary)] transition-colors
                     hover:bg-[var(--color-surface-2)]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Key Row ───────────────────────────────────────────────────────────────────

interface IKeyRowProps {
  apiKey: ILocalAPIKey
  onToggle: (id: string, active: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function KeyRow({ apiKey, onToggle, onDelete }: IKeyRowProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const provider = PROVIDERS.find((p) => p.value === apiKey.provider)

  const masked = `${'•'.repeat(8)}${apiKey.rawKey.slice(-4)}`

  const handleToggle = async (): Promise<void> => {
    setBusy(true)
    try { await onToggle(apiKey.id, !apiKey.isActive) } finally { setBusy(false) }
  }

  const handleDelete = async (): Promise<void> => {
    if (!confirm(`Remove ${provider?.label ?? apiKey.provider} key?`)) return
    setBusy(true)
    try { await onDelete(apiKey.id) } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)]
                    bg-[var(--color-surface)] px-4 py-3">
      <span className="text-xl">{provider?.icon ?? '🔑'}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {provider?.label ?? apiKey.provider}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] truncate">
          {apiKey.label ? `${apiKey.label} · ` : ''}{masked}
        </p>
      </div>

      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
          apiKey.isActive
            ? 'bg-green-500/10 text-green-400'
            : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
        }`}
      >
        {apiKey.isActive ? 'Active' : 'Off'}
      </span>

      <button
        onClick={() => void handleToggle()}
        disabled={busy}
        className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs
                   text-[var(--color-text-secondary)] transition-colors
                   hover:bg-[var(--color-surface-2)] disabled:opacity-50"
      >
        {apiKey.isActive ? 'Disable' : 'Enable'}
      </button>

      <button
        onClick={() => void handleDelete()}
        disabled={busy}
        className="shrink-0 rounded-lg px-2.5 py-1 text-xs text-[var(--color-danger)]
                   transition-colors hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface IAPIKeysPanelProps {
  onBack: () => void
}

export function APIKeysPanel({ onBack }: IAPIKeysPanelProps): React.JSX.Element {
  const [keys, setKeys] = useState<ILocalAPIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await listAPIKeys()
    setKeys(data)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSaved = (key: ILocalAPIKey): void => {
    setKeys((prev) => {
      const idx = prev.findIndex((k) => k.provider === key.provider)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = key
        return copy
      }
      return [...prev, key]
    })
    setShowForm(false)
  }

  const handleToggle = async (id: string, active: boolean): Promise<void> => {
    const updated = await setAPIKeyActive(id, active)
    if (updated) setKeys((prev) => prev.map((k) => (k.id === id ? updated : k)))
  }

  const handleDelete = async (id: string): Promise<void> => {
    await deleteAPIKey(id)
    setKeys((prev) => prev.filter((k) => k.id !== id))
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors
                     hover:bg-[var(--color-surface-2)]"
        >
          ←
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">API Keys</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Stored locally on this device — never sent to the cloud.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium
                       text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            + Add
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4">
          <AddKeyForm
            existingProviders={keys.map((k) => k.provider)}
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {loading ? (
        <p className="text-xs text-[var(--color-text-secondary)]">Loading…</p>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">
          <p className="text-lg mb-1">🔑</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No keys saved</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Add a provider key to use your own quota.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <KeyRow
              key={key.id}
              apiKey={key}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
