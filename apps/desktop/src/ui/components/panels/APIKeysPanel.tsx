/**
 * APIKeysPanel.tsx — local BYOK key management for the desktop app.
 *
 * Keys are stored on-device (OS keychain in production, localStorage in dev).
 * They are NEVER sent to the cloud backend.
 */

import React, { useCallback, useEffect, useState } from 'react'
import {
  deleteAPIKey,
  getDefaultKeyId,
  listAPIKeys,
  saveAPIKey,
  setAPIKeyActive,
  setDefaultKeyId,
  updateAPIKey,
  type ILocalAPIKey,
} from '../../../bridges/api-key-store.js'
import { useAppStore } from '../../store/app-store.js'

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', icon: '🤖', placeholder: 'sk-…' },
  { value: 'anthropic', label: 'Anthropic', icon: '🧠', placeholder: 'sk-ant-…' },
  { value: 'google', label: 'Google Gemini', icon: '✨', placeholder: 'AIza…' },
  { value: 'mistral', label: 'Mistral AI', icon: '💨', placeholder: 'key…' },
  { value: 'cohere', label: 'Cohere', icon: '🔮', placeholder: 'key…' },
  { value: 'groq', label: 'Groq', icon: '⚡', placeholder: 'gsk_…' },
]

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o3-mini', label: 'o3 Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
  google: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  mistral: [
    { value: 'mistral-small-latest', label: 'Mistral Small' },
    { value: 'mistral-medium-latest', label: 'Mistral Medium' },
    { value: 'mistral-large-latest', label: 'Mistral Large' },
  ],
  groq: [
    { value: 'llama3-8b-8192', label: 'LLaMA 3 8B' },
    { value: 'llama3-70b-8192', label: 'LLaMA 3 70B' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  ],
  cohere: [
    { value: 'command-r-plus', label: 'Command R+' },
    { value: 'command-r', label: 'Command R' },
  ],
}

// ── Add Key Form ──────────────────────────────────────────────────────────────

interface IAddFormProps {
  onSaved: (key: ILocalAPIKey) => void
  onCancel: () => void
}

function AddKeyForm({ onSaved, onCancel }: IAddFormProps): React.JSX.Element {
  const [provider, setProvider] = useState('')
  const [label, setLabel] = useState('')
  const [rawKey, setRawKey] = useState('')
  const [model, setModel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = PROVIDERS.find((p) => p.value === provider)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!provider || !rawKey.trim()) return
    setBusy(true)
    setError(null)
    try {
      const saved = await saveAPIKey(provider, rawKey.trim(), label.trim(), model || undefined)
      onSaved(saved)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      useAppStore.getState().pushNotification({ level: 'error', title: 'Failed to save API key', body: msg })
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
          onChange={(e) => { setProvider(e.target.value); setModel('') }}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                     px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                     focus:border-[var(--color-accent)]"
        >
          <option value="">Select provider…</option>
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.icon} {p.label}
            </option>
          ))}
        </select>
      </div>

      {provider && (PROVIDER_MODELS[provider]?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-secondary)]">
            Model <span className="text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <select
            value={model}
            onChange={(e) => { setModel(e.target.value) }}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                       px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                       focus:border-[var(--color-accent)]"
          >
            <option value="">Provider default</option>
            {(PROVIDER_MODELS[provider] ?? []).map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-[var(--color-text-secondary)]">
          Label <span className="text-[var(--color-text-muted)]">(optional)</span>
        </label>
        <input
          type="text"
          maxLength={200}
          placeholder="e.g. personal"
          value={label}
          onChange={(e) => { setLabel(e.target.value) }}
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
          onChange={(e) => { setRawKey(e.target.value) }}
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
  isDefault: boolean
  onToggle: (id: string, active: boolean) => Promise<void>
  onSetDefault: (id: string) => Promise<void>
  onChangeModel: (id: string, model: string | undefined) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function KeyRow({ apiKey, isDefault, onToggle, onSetDefault, onChangeModel, onDelete }: IKeyRowProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const provider = PROVIDERS.find((p) => p.value === apiKey.provider)

  const masked = `${'•'.repeat(8)}${apiKey.rawKey.slice(-4)}`

  const handleToggle = async (): Promise<void> => {
    setBusy(true)
    try { await onToggle(apiKey.id, !apiKey.isActive) } finally { setBusy(false) }
  }

  const handleSetDefault = async (): Promise<void> => {
    setBusy(true)
    try { await onSetDefault(apiKey.id) } finally { setBusy(false) }
  }

  const handleDelete = async (): Promise<void> => {
    setBusy(true)
    setConfirmDelete(false)
    try { await onDelete(apiKey.id) } finally { setBusy(false) }
  }

  return (
    <div className={`flex items-center gap-3 rounded-xl border bg-[var(--color-surface)] px-4 py-3 ${isDefault ? 'border-[var(--color-accent)]/50' : 'border-[var(--color-border)]'
      }`}>
      <span className="text-xl">{provider?.icon ?? '🔑'}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {provider?.label ?? apiKey.provider}
          </p>
          {isDefault && (
            <span className="rounded-full bg-[var(--color-accent)]/15 px-1.5 py-0.5
                             text-[10px] font-semibold text-[var(--color-accent)]">
              Default
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] truncate">
          {apiKey.label ? `${apiKey.label} · ` : ''}{masked}
        </p>
        {(PROVIDER_MODELS[apiKey.provider]?.length ?? 0) > 0 && (
          <div className="mt-0.5 flex items-center gap-1">
            <span className="text-[11px] text-[var(--color-text-muted)]">Model:</span>
            <select
              value={apiKey.model ?? ''}
              onChange={(e) => { void onChangeModel(apiKey.id, e.target.value || undefined) }}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-1.5 py-0 text-[11px] text-[var(--color-text-secondary)]
                         outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">Default</option>
              {(PROVIDER_MODELS[apiKey.provider] ?? []).map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${apiKey.isActive
            ? 'bg-green-500/10 text-green-400'
            : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
          }`}
      >
        {apiKey.isActive ? 'Active' : 'Off'}
      </span>

      {/* Set as default */}
      {!isDefault && (
        <button
          onClick={() => { void handleSetDefault() }}
          disabled={busy}
          title="Set as default key for all agents"
          className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs
                     text-[var(--color-text-secondary)] transition-colors
                     hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]
                     disabled:opacity-50"
        >
          ★ Set default
        </button>
      )}

      <button
        onClick={() => void handleToggle()}
        disabled={busy}
        className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs
                   text-[var(--color-text-secondary)] transition-colors
                   hover:bg-[var(--color-surface-2)] disabled:opacity-50"
      >
        {apiKey.isActive ? 'Disable' : 'Enable'}
      </button>

      {confirmDelete ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setConfirmDelete(false) }}
            className="shrink-0 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleDelete()}
            disabled={busy}
            className="shrink-0 rounded-lg bg-red-950/60 px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/60 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setConfirmDelete(true) }}
          disabled={busy}
          className="shrink-0 rounded-lg px-2.5 py-1 text-xs text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
        >
          Remove
        </button>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface IAPIKeysPanelProps {
  onBack: () => void
}

export function APIKeysPanel({ onBack }: IAPIKeysPanelProps): React.JSX.Element {
  const [keys, setKeys] = useState<ILocalAPIKey[]>([])
  const [defaultKeyId, setDefaultKeyIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [data, defId] = await Promise.all([listAPIKeys(), getDefaultKeyId()])
    setKeys(data)
    setDefaultKeyIdState(defId)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSaved = (key: ILocalAPIKey): void => {
    setKeys((prev) => [...prev, key])
    // Auto-set as default if it's the first key ever added.
    setDefaultKeyIdState((prev) => prev ?? key.id)
    if (defaultKeyId === null) void setDefaultKeyId(key.id)
    setShowForm(false)
  }

  const handleToggle = async (id: string, active: boolean): Promise<void> => {
    try {
      const updated = await setAPIKeyActive(id, active)
      if (updated) setKeys((prev) => prev.map((k) => (k.id === id ? updated : k)))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      useAppStore.getState().pushNotification({ level: 'error', title: 'Failed to update API key', body: msg })
    }
  }

  const handleSetDefault = async (id: string): Promise<void> => {
    await setDefaultKeyId(id)
    setDefaultKeyIdState(id)
  }

  const handleChangeModel = async (id: string, model: string | undefined): Promise<void> => {
    try {
      const updated = await updateAPIKey(id, model !== undefined ? { model } : {})
      if (updated) setKeys((prev) => prev.map((k) => (k.id === id ? updated : k)))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      useAppStore.getState().pushNotification({ level: 'error', title: 'Failed to update model', body: msg })
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await deleteAPIKey(id)
      // If the deleted key was the default, clear it.
      if (defaultKeyId === id) {
        await setDefaultKeyId(null)
        setDefaultKeyIdState(null)
      }
      setKeys((prev) => prev.filter((k) => k.id !== id))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      useAppStore.getState().pushNotification({ level: 'error', title: 'Failed to remove API key', body: msg })
    }
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3.5">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">API Keys</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Stored on-device only — never sent to the cloud
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true) }}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            + Add key
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {showForm && (
          <div className="mb-4">
            <AddKeyForm
              onSaved={handleSaved}
              onCancel={() => { setShowForm(false) }}
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
            Loading…
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-2xl">
              🔑
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">No keys saved yet</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              Add a provider API key to use your own AI quota.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <KeyRow
                key={key.id}
                apiKey={key}
                isDefault={key.id === defaultKeyId}
                onToggle={handleToggle}
                onSetDefault={handleSetDefault}
                onChangeModel={handleChangeModel}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
