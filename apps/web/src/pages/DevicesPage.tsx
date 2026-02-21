/**
 * DevicesPage.tsx — list + manage registered Desktop Agent devices.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeviceStore } from '../store/device-store.js'
import type { IDevice } from '../lib/api-client.js'
// IDevice is used in onRegister return type and DeviceRow prop

// ── Register Device Modal ─────────────────────────────────────────────────────

interface IRegisterModalProps {
  onClose(): void
  onRegister(name: string, platform: string, version: string): Promise<IDevice>
}

function RegisterModal({ onClose, onRegister }: IRegisterModalProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('macOS')
  const [version, setVersion] = useState('1.0.0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onRegister(name.trim(), platform, version.trim())
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)]
                      bg-[var(--color-surface)] p-6 shadow-2xl">
        <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">
          Register device
        </h2>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Device name</label>
            <input
              type="text"
              required
              placeholder="My MacBook"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            >
              <option>macOS</option>
              <option>Windows</option>
              <option>Linux</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">Agent version</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--color-border)] py-2 text-sm
                         text-[var(--color-text-secondary)] transition-colors
                         hover:bg-[var(--color-surface-2)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-[var(--color-accent)] py-2 text-sm font-medium
                         text-white transition-colors hover:bg-[var(--color-accent-hover)]
                         disabled:opacity-50"
            >
              {loading ? 'Registering…' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Device Row ────────────────────────────────────────────────────────────────

interface IDeviceRowProps {
  device: IDevice
  onRename(id: string, name: string): Promise<void>
  onRemove(id: string): Promise<void>
}

function DeviceRow({ device, onRename, onRemove }: IDeviceRowProps): React.JSX.Element {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(device.name)
  const [loading, setLoading] = useState(false)

  const handleRename = async (): Promise<void> => {
    if (editName.trim() === device.name) {
      setEditing(false)
      return
    }
    setLoading(true)
    try {
      await onRename(device.id, editName.trim())
      setEditing(false)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (): Promise<void> => {
    if (!window.confirm(`Remove device "${device.name}"?`)) return
    await onRemove(device.id)
  }

  const isOnline = device.status === 'online'

  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)]
                    bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-[var(--color-text-muted)]'}`} />

        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => void handleRename()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleRename()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="rounded-md border border-[var(--color-accent)] bg-[var(--color-surface-2)]
                       px-2 py-0.5 text-sm text-[var(--color-text-primary)] outline-none"
          />
        ) : (
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{device.name}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {device.platform} · v{device.version}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-[var(--color-text-muted)]'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
        {device.last_seen_at && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {new Date(device.last_seen_at).toLocaleString()}
          </span>
        )}

        <button
          onClick={() => { navigate(`/devices/${device.id}`) }}
          title="View machine detail"
          className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]"
        >
          View →
        </button>

        <button
          onClick={() => setEditing(true)}
          disabled={loading}
          title="Rename"
          className="rounded-lg p-1.5 text-sm text-[var(--color-text-secondary)]
                     transition-colors hover:bg-[var(--color-surface-2)]"
        >
          ✏️
        </button>
        <button
          onClick={() => void handleRemove()}
          disabled={loading}
          title="Remove"
          className="rounded-lg p-1.5 text-sm text-[var(--color-danger)]
                     transition-colors hover:bg-[var(--color-danger)]/10"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DevicesPage(): React.JSX.Element {
  const { devices, loading, error, fetchDevices, registerDevice, renameDevice, removeDevice } =
    useDeviceStore()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    void fetchDevices()
    // Auto-refresh device status every 30 s
    const handle = setInterval(() => { void fetchDevices() }, 30_000)
    return () => { clearInterval(handle) }
  }, [fetchDevices])

  const onlineCount = devices.filter((d) => d.status === 'online').length

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Devices</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            {onlineCount} online · {devices.length} total
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium
                     text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          + Register device
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {loading && devices.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <p className="text-3xl">💻</p>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            No devices registered yet.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm
                       font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Register your first device
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              onRename={renameDevice}
              onRemove={removeDevice}
            />
          ))}
        </div>
      )}

      {showModal && (
        <RegisterModal
          onClose={() => setShowModal(false)}
          onRegister={registerDevice}
        />
      )}
    </div>
  )
}
