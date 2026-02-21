/**
 * BotListPage.tsx — main dashboard showing all bots for the logged-in user.
 */

import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBotStore } from '../store/bot-store.js'
import { BotCard } from '../components/BotCard.js'

export function BotListPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { bots, loading, error, fetchBots, deleteBot } = useBotStore()

  useEffect(() => {
    void fetchBots()
  }, [fetchBots])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-6 py-4">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">My Bots</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {bots.length} bot{bots.length !== 1 ? 's' : ''} — they run on your desktop app
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-lg bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {loading && bots.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-[var(--color-text-secondary)]">
            Loading bots…
          </div>
        ) : bots.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-[var(--color-text-secondary)]">No bots yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                onSelect={() => { navigate(`/bots/${bot.id}`) }}
                onDelete={() => { void deleteBot(bot.id) }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
