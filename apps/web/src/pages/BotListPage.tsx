/**
 * BotListPage.tsx — main dashboard showing all bots for the logged-in user.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBotStore } from '../store/bot-store.js'
import { BotCard } from '../components/BotCard.js'
import { CreateBotModal } from '../components/CreateBotModal.js'

export function BotListPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { bots, loading, error, fetchBots, createBot, startBot, updateBotStatus, deleteBot } =
    useBotStore()
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    void fetchBots()
  }, [fetchBots])

  const handleStart = async (botId: string): Promise<void> => {
    await startBot(botId)
    // Navigate to detail page so the user can watch the run appear in history.
    navigate(`/bots/${botId}`)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">My Bots</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {bots.length} bot{bots.length !== 1 ? 's' : ''} — they run on your desktop app
          </p>
        </div>
        <button
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium
                     text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          onClick={() => setShowCreate(true)}
        >
          + New Bot
        </button>
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
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
            <p className="text-[var(--color-text-secondary)]">No bots yet.</p>
            <button
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium
                         text-white hover:bg-[var(--color-accent-hover)]"
              onClick={() => setShowCreate(true)}
            >
              Create your first bot
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                onSelect={() => navigate(`/bots/${bot.id}`)}
                onStart={() => void handleStart(bot.id)}
                onTogglePause={() =>
                  void updateBotStatus(bot.id, bot.status === 'active' ? 'paused' : 'active')
                }
                onDelete={() => void deleteBot(bot.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateBotModal
          onSubmit={async (input) => { await createBot(input) }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
