/**
 * BotRunLog.tsx — table of bot runs with status badge and timestamps.
 */

import React from 'react'
import type { IBotRun } from '../lib/api-client.js'

interface Props {
  runs: IBotRun[]
  loading?: boolean
}

const STATUS_STYLE: Record<string, string> = {
  pending:   'text-[var(--color-text-secondary)] bg-[var(--color-surface-2)]',
  running:   'text-[var(--color-accent)] bg-[var(--color-accent-dim)]',
  completed: 'text-[var(--color-success)] bg-[var(--color-success)]/10',
  failed:    'text-[var(--color-danger)] bg-[var(--color-danger)]/10',
  cancelled: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10',
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString()
}

function duration(run: IBotRun): string {
  if (!run.ended_at) return run.status === 'running' ? 'running…' : '—'
  const ms = new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}m`
}

export function BotRunLog({ runs, loading }: Props): React.JSX.Element {
  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Loading runs…
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-[var(--color-text-secondary)]">
        No runs yet — click "Run" to start the bot.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)]">
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium">Steps</th>
            <th className="pb-2 pr-4 font-medium">Duration</th>
            <th className="pb-2 pr-4 font-medium">Started</th>
            <th className="pb-2 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.id}
              className="border-b border-[var(--color-border)]/50 last:border-0"
            >
              <td className="py-2 pr-4">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[run.status] ?? ''}`}
                >
                  {run.status}
                </span>
              </td>
              <td className="py-2 pr-4 text-[var(--color-text-primary)]">{run.steps}</td>
              <td className="py-2 pr-4 text-[var(--color-text-secondary)]">{duration(run)}</td>
              <td className="py-2 pr-4 text-[var(--color-text-secondary)]">{fmt(run.started_at)}</td>
              <td className="py-2 max-w-xs truncate text-[var(--color-text-secondary)]">
                {run.result || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
