/**
 * WorkspaceDetailPage.tsx — view a workspace's run history and trigger new runs.
 */

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWorkspaceStore } from '../store/workspace-store.js'
import type { IWorkspace, IWorkspaceRun } from '../lib/api-client.js'

// ── Run Row ───────────────────────────────────────────────────────────────────

interface IRunRowProps {
  run: IWorkspaceRun
}

function RunRow({ run }: IRunRowProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const statusColor: Record<IWorkspaceRun['status'], string> = {
    completed: 'text-green-400',
    running: 'text-yellow-400',
    failed: 'text-[var(--color-danger)]',
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xs font-medium ${statusColor[run.status]}`}>
            {run.status}
          </span>
          <p className="truncate text-sm text-[var(--color-text-primary)]">{run.input}</p>
        </div>
        <div className="flex items-center gap-3 ml-4 shrink-0 text-xs text-[var(--color-text-muted)]">
          <span>{run.tokens_used.toLocaleString()} tokens</span>
          <span>{run.model}</span>
          <span>{new Date(run.created_at).toLocaleString()}</span>
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-border)] px-4 pb-4 pt-3">
          <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Input</p>
          <pre className="mb-4 whitespace-pre-wrap rounded-lg bg-[var(--color-surface-2)]
                          p-3 text-xs text-[var(--color-text-primary)]">{run.input}</pre>

          <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Output</p>
          <pre className="whitespace-pre-wrap rounded-lg bg-[var(--color-surface-2)]
                          p-3 text-xs text-[var(--color-text-primary)]">{run.output || '—'}</pre>

          <button
            onClick={() => navigator.clipboard.writeText(run.output).catch(() => undefined)}
            className="mt-3 rounded-lg border border-[var(--color-border)] px-3 py-1.5
                       text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
          >
            Copy output
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WorkspaceDetailPage(): React.JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const {
    workspaces,
    runs,
    fetchWorkspaces,
    updateWorkspace,
    fetchRuns,
    saveRun,
  } = useWorkspaceStore()

  const [loadingRuns, setLoadingRuns] = useState(false)
  const [input, setInput] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  // Rename state
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')

  const workspace: IWorkspace | undefined = workspaces.find((w) => w.id === workspaceId)
  const workspaceRuns: IWorkspaceRun[] = workspaceId ? (runs[workspaceId] ?? []) : []

  useEffect(() => {
    if (workspaces.length === 0) void fetchWorkspaces()
  }, [workspaces.length, fetchWorkspaces])

  useEffect(() => {
    if (!workspaceId) return
    setLoadingRuns(true)
    fetchRuns(workspaceId).finally(() => setLoadingRuns(false))
  }, [workspaceId, fetchRuns])

  const handleRun = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!workspaceId || !input.trim()) return
    setRunError(null)
    setRunning(true)
    try {
      // Placeholder: save the run with simulated output.
      // In production this would call the AI orchestrator.
      await saveRun(workspaceId, input.trim(), '(Run via Desktop Agent)', 0, model)
      setInput('')
    } catch (err) {
      setRunError((err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const handleRename = async (): Promise<void> => {
    if (!workspaceId || !newName.trim()) return
    try {
      await updateWorkspace(workspaceId, newName.trim())
      setEditingName(false)
    } catch {
      // ignore
    }
  }

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading workspace…</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/workspaces')}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          ← Workspaces
        </button>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        {editingName ? (
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => void handleRename()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleRename()
              if (e.key === 'Escape') setEditingName(false)
            }}
            className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-surface-2)]
                       px-3 py-1.5 text-xl font-semibold text-[var(--color-text-primary)] outline-none"
          />
        ) : (
          <h1
            className="cursor-pointer text-xl font-semibold text-[var(--color-text-primary)]
                       hover:text-[var(--color-accent)]"
            title="Click to rename"
            onClick={() => {
              setNewName(workspace.name)
              setEditingName(true)
            }}
          >
            {workspace.name}
          </h1>
        )}
        <span className="text-sm text-[var(--color-text-secondary)]">
          {workspace.app_name ?? 'No app'}
        </span>
      </div>

      {/* Run form */}
      <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">New run</h2>
        <form onSubmit={(e) => void handleRun(e)} className="flex flex-col gap-3">
          <textarea
            rows={4}
            required
            placeholder="Enter prompt or input for this workspace…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                       px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none resize-none
                       focus:border-[var(--color-accent)]"
          />

          <div className="flex items-center gap-3">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            >
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="claude-3-5-haiku-20241022">claude-3-5-haiku</option>
              <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet</option>
            </select>

            {runError && (
              <p className="flex-1 text-xs text-[var(--color-danger)]">{runError}</p>
            )}

            <button
              type="submit"
              disabled={running || !input.trim()}
              className="ml-auto rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm
                         font-medium text-white hover:bg-[var(--color-accent-hover)]
                         disabled:opacity-50"
            >
              {running ? 'Running…' : '▶ Run'}
            </button>
          </div>
        </form>
      </div>

      {/* Run history */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          Run history{' '}
          <span className="font-normal text-[var(--color-text-muted)]">
            ({workspaceRuns.length})
          </span>
        </h2>

        {loadingRuns ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
        ) : workspaceRuns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">No runs yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workspaceRuns.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
