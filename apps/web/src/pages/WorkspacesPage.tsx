/**
 * WorkspacesPage.tsx — list and create workspaces.
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspaceStore } from '../store/workspace-store.js'
import { useMarketplaceStore } from '../store/marketplace-store.js'

export function WorkspacesPage(): React.JSX.Element {
  const { workspaces, loading, error, fetchWorkspaces, createWorkspace, deleteWorkspace } =
    useWorkspaceStore()
  const { installedApps, fetchInstalled } = useMarketplaceStore()

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAppId, setNewAppId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    void fetchWorkspaces()
    void fetchInstalled()
  }, [fetchWorkspaces, fetchInstalled])

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)
    try {
      await createWorkspace(newName.trim(), newAppId || undefined)
      setNewName('')
      setNewAppId('')
      setShowCreate(false)
    } catch (err) {
      setCreateError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, name: string): Promise<void> => {
    if (!window.confirm(`Delete workspace "${name}"? This cannot be undone.`)) return
    await deleteWorkspace(id)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Workspaces</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium
                     text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          + New workspace
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
            New workspace
          </h2>
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">Name</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="My workspace"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                           px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                           focus:border-[var(--color-accent)]"
              />
            </div>

            {installedApps.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                  App (optional)
                </label>
                <select
                  value={newAppId}
                  onChange={(e) => setNewAppId(e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                             px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                             focus:border-[var(--color-accent)]"
                >
                  <option value="">None</option>
                  {installedApps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {createError && (
              <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
                {createError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-lg border border-[var(--color-border)] py-2 text-sm
                           text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 rounded-lg bg-[var(--color-accent)] py-2 text-sm font-medium
                           text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && workspaces.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      ) : workspaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <p className="text-3xl">🗂️</p>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            No workspaces yet.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm
                       font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Create workspace
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="flex items-center justify-between rounded-xl border border-[var(--color-border)]
                         bg-[var(--color-surface)] px-4 py-3"
            >
              <Link
                to={`/workspaces/${ws.id}`}
                className="flex-1 min-w-0"
              >
                <p className="truncate text-sm font-medium text-[var(--color-text-primary)]
                              hover:text-[var(--color-accent)]">
                  {ws.name}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {ws.app_name ?? 'No app'} · Updated {new Date(ws.updated_at).toLocaleDateString()}
                </p>
              </Link>

              <div className="flex items-center gap-2 ml-4">
                <Link
                  to={`/workspaces/${ws.id}`}
                  className="rounded-lg px-3 py-1.5 text-xs border border-[var(--color-border)]
                             text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                >
                  Open →
                </Link>
                <button
                  onClick={() => void handleDelete(ws.id, ws.name)}
                  className="rounded-lg p-1.5 text-[var(--color-danger)]
                             hover:bg-[var(--color-danger)]/10"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
