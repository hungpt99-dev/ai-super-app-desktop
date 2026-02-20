/**
 * MarketplacePage.tsx — browse and install mini-apps.
 */

import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMarketplaceStore } from '../store/marketplace-store.js'
import type { IMiniApp } from '../lib/api-client.js'

const CATEGORIES = ['all', 'writing', 'development', 'productivity', 'automation', 'research']

interface IMiniAppCardProps {
  app: IMiniApp
  onInstall(id: string): Promise<void>
  onUninstall(id: string): Promise<void>
}

function MiniAppCard({ app, onInstall, onUninstall }: IMiniAppCardProps): React.JSX.Element {
  const [busy, setBusy] = React.useState(false)

  const handleToggle = async (): Promise<void> => {
    setBusy(true)
    try {
      if (app.installed) {
        await onUninstall(app.id)
      } else {
        await onInstall(app.id)
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
          📦
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to={`/marketplace/${app.id}`}
            className="block truncate text-sm font-semibold text-[var(--color-text-primary)]
                       hover:text-[var(--color-accent)]"
          >
            {app.name}
          </Link>
          <p className="text-xs text-[var(--color-text-secondary)]">{app.developer}</p>
        </div>
      </div>

      <p className="mb-4 flex-1 text-xs text-[var(--color-text-secondary)] line-clamp-2">
        {app.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>⭐ {app.rating.toFixed(1)}</span>
          <span>·</span>
          <span>{app.install_count.toLocaleString()} installs</span>
        </div>

        <button
          onClick={() => void handleToggle()}
          disabled={busy}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50
            ${app.installed
              ? 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/40'
              : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
            }`}
        >
          {busy ? '…' : app.installed ? 'Uninstall' : app.is_free ? 'Install' : `$${app.price_usd}`}
        </button>
      </div>
    </div>
  )
}

export function MarketplacePage(): React.JSX.Element {
  const {
    apps, loading, error,
    searchQuery, selectedCategory,
    fetchApps, fetchInstalled, install, uninstall,
    setSearch, setCategory,
  } = useMarketplaceStore()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void fetchApps()
    void fetchInstalled()
  }, [fetchApps, fetchInstalled])

  const handleSearchChange = (q: string): void => {
    setSearch(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchApps(q, selectedCategory)
    }, 300)
  }

  const handleCategoryChange = (cat: string): void => {
    setCategory(cat)
    void fetchApps(searchQuery, cat)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Marketplace</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          Discover and install AI mini-apps
        </p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search apps…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
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
            onClick={() => handleCategoryChange(cat)}
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

      {loading && apps.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      ) : apps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No apps found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {apps.map((app) => (
            <MiniAppCard
              key={app.id}
              app={app}
              onInstall={install}
              onUninstall={uninstall}
            />
          ))}
        </div>
      )}
    </div>
  )
}
