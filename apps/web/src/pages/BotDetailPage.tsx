/**
 * BotDetailPage.tsx — shows a single bot with its goal, controls, and run history.
 */

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBotStore } from '../store/bot-store.js'
import { BotRunLog } from '../components/BotRunLog.js'

const STATUS_COLOR: Record<string, string> = {
  active: 'text-[var(--color-success)] bg-[var(--color-success)]/10',
  paused: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10',
}

export function BotDetailPage(): React.JSX.Element {
  const { botId } = useParams<{ botId: string }>()
  const navigate = useNavigate()
  const {
    bots, runs, fetchBots, fetchRuns, startBot, updateBotStatus, deleteBot,
  } = useBotStore()

  const [runLoading, setRunLoading] = useState(false)
  const [startLoading, setStartLoading] = useState(false)

  const bot = bots.find((b) => b.id === botId)
  const botRuns = (botId ? runs[botId] : undefined) ?? []

  useEffect(() => {
    if (bots.length === 0) void fetchBots()
  }, [bots.length, fetchBots])

  useEffect(() => {
    if (!botId) return
    setRunLoading(true)
    void fetchRuns(botId).finally(() => setRunLoading(false))
  }, [botId, fetchRuns])

  const handleStart = async (): Promise<void> => {
    if (!botId) return
    setStartLoading(true)
    try {
      await startBot(botId)
    } finally {
      setStartLoading(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!botId) return
    if (!window.confirm('Delete this bot and all its run history?')) return
    await deleteBot(botId)
    navigate('/bots')
  }

  if (!bot) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-secondary)]">
        {bots.length === 0 ? 'Loading…' : 'Bot not found.'}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-4">
        <button
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          onClick={() => navigate('/bots')}
        >
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-[var(--color-text-primary)]">
              {bot.name}
            </h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[bot.status] ?? ''}`}>
              {bot.status}
            </span>
          </div>
          {bot.description && (
            <p className="truncate text-xs text-[var(--color-text-secondary)]">{bot.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium
                       text-[var(--color-text-secondary)] transition-colors
                       hover:border-[var(--color-warning)]/50 hover:text-[var(--color-warning)]"
            onClick={() => void updateBotStatus(bot.id, bot.status === 'active' ? 'paused' : 'active')}
          >
            {bot.status === 'active' ? '⏸ Pause' : '▶ Activate'}
          </button>
          <button
            className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white
                       transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            disabled={startLoading}
            title="Dispatch this bot to run on your connected desktop device"
            onClick={() => void handleStart()}
          >
            {startLoading ? 'Dispatching…' : '▶ Run Now'}
          </button>
          <button
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium
                       text-[var(--color-text-secondary)] transition-colors
                       hover:border-[var(--color-danger)]/50 hover:text-[var(--color-danger)]"
            onClick={() => void handleDelete()}
          >
            🗑
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Goal */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Goal
          </h2>
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]
                        px-4 py-3 text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
            {bot.goal}
          </p>
        </section>

        {/* Run history */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Run History
            </h2>
            <button
              className="text-xs text-[var(--color-accent)] hover:underline"
              onClick={() => botId && void fetchRuns(botId)}
            >
              Refresh
            </button>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <BotRunLog runs={botRuns} loading={runLoading} />
          </div>
        </section>
      </div>
    </div>
  )
}
