/**
 * BotCard.tsx — single bot tile displayed in the bot list.
 * Status badge and quick delete action.
 */

import React from 'react'
import type { IBot } from '../lib/api-client.js'

interface IBotCardProps {
  bot: IBot
  onSelect: () => void
  onDelete: () => void
}

const STATUS_COLOR: Record<string, string> = {
  active: 'text-[var(--color-success)] bg-[var(--color-success)]/10',
  paused: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10',
}

export function BotCard({ bot, onSelect, onDelete }: IBotCardProps): React.JSX.Element {
  return (
    <div
      className="group relative flex flex-col gap-3 rounded-xl border border-[var(--color-border)]
                 bg-[var(--color-surface)] p-4 transition-all hover:border-[var(--color-accent)]/40
                 hover:bg-[var(--color-surface-2)] cursor-pointer"
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--color-text-primary)]">{bot.name}</p>
          {bot.description && (
            <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
              {bot.description}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[bot.status] ?? ''}`}
        >
          {bot.status}
        </span>
      </div>

      {/* Goal preview */}
      <p className="line-clamp-2 text-xs text-[var(--color-text-secondary)]">{bot.goal}</p>

      {/* Actions */}
      <div
        className="flex items-center justify-end"
        onClick={(e) => { e.stopPropagation() }}
      >
        <button
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium
                     text-[var(--color-text-secondary)] transition-colors
                     hover:border-[var(--color-danger)]/50 hover:text-[var(--color-danger)]"
          onClick={onDelete}
        >
          🗑
        </button>
      </div>
    </div>
  )
}
