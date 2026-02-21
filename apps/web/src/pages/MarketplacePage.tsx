/**
 * MarketplacePage.tsx — browse and install bots.
 */

import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMarketplaceStore } from '../store/marketplace-store.js'
import type { IMarketplaceBot } from '../lib/api-client.js'

const CATEGORIES = ['all', 'writing', 'development', 'productivity', 'automation', 'research']

interface IMarketplaceBotCardProps {
  bot: IMarketplaceBot
  onInstall: (id: string) => Promise<void>
  onUninstall: (id: string) => Promise<void>
}

function MarketplaceBotCard({ bot, onInstall, onUninstall }: IMarketplaceBotCardProps): React.JSX.Element {
  const [busy, setBusy] = React.useState(false)

  const handleToggle = async (): Promise<void> => {
    setBusy(true)
    try {
      if (bot.installed) {
        await onUninstall(bot.id)
      } else {
        await onInstall(bot.id)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-[var(--color-border)]
                    bg-[var(--color-surface)] p-4 transition-colors
                    hover:border-[var(--color-accent)]/40">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
                        bg-[var(--color-surface-2)] text-xl">
          🤖
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to={`/marketplace/${bot.id}`}
            className="block truncate text-sm font-semibold text-[var(--color-text-primary)]
                       hover:text-[var(--color-accent)]"
          >
            {bot.name}
          </Link>
          <p className="text-xs text-[var(--color-text-secondary)]">{bot.developer}</p>
        </div>
      </div>

      <p className="mb-4 flex-1 text-xs text-[var(--color-text-secondary)] line-clamp-2">
        {bot.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>⭐ {bot.rating.toFixed(1)}</span>
          <span>·</span>
          <span>{bot.install_count.toLocaleString()} installs</span>
        </div>

        <button
          onClick={() => void handleToggle()}
          disabled={busy}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50
            ${bot.installed
              ? 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/40'
              : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
            }`}
        >
          {busy ? '…' : bot.installed ? 'Uninstall' : bot.is_free ? 'Install' : `$${String(bot.price_usd ?? 0)}`}
        </button>
      </div>
    </div>
  )
}

export function MarketplacePage(): React.JSX.Element {
  const fetchBots = useMarketplaceStore((s) => s.fetchBots)
  const fetchInstalled = useMarketplaceStore((s) => s.fetchInstalled)
  const install = useMarketplaceStore((s) => s.install)
  const uninstall = useMarketplaceStore((s) => s.uninstall)
  const setSearch = useMarketplaceStore((s) => s.setSearch)
  const setCategory = useMarketplaceStore((s) => s.setCategory)
  const {
    bots, loading, error,
    searchQuery, selectedCategory,
  } = useMarketplaceStore()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void fetchBots()
    void fetchInstalled()
  }, [fetchBots, fetchInstalled])

  const handleSearchChange = (q: string): void => {
    setSearch(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchBots(q, selectedCategory)
    }, 300)
  }

  const handleCategoryChange = (cat: string): void => {
    setCategory(cat)
    void fetchBots(searchQuery, cat)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Bot Marketplace</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          Discover and install AI bots built by developers
        </p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search bots…"
          value={searchQuery}
          onChange={(e) => { handleSearchChange(e.target.value) }}
          className="w-full max-w-sm rounded-lg border border-[var(--color-border)]
                     bg-[var(--color-surface-2)] px-4 py-2 text-sm
                     text-[var(--color-text-primary)] outline-none
                     focus:border-[var(--color-accent)]"
        />
      </div>

      {/* Category tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => { handleCategoryChange(cat) }}
            className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors
              ${selectedCategory === cat
                ? 'bg-[var(--color-accent)] text-white'
                : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]'
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {loading && bots.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      ) : bots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <p className="text-3xl">🤖</p>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No bots found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bots.map((bot) => (
            <MarketplaceBotCard
              key={bot.id}
              bot={bot}
              onInstall={install}
              onUninstall={uninstall}
            />
          ))}
        </div>
      )}
    </div>
  )
}
