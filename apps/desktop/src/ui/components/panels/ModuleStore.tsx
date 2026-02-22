import React, { useState } from 'react'
import { useAgentTypesStore } from '../../store/agent-types-store.js'
import {
  AGENT_TEMPLATES,
} from '../../store/agent-templates.js'

// ─── Store ────────────────────────────────────────────────────────────────────

/** All bot types available — built-in only (downloadable types come from the marketplace API). */
const ALL_BOT_TYPES = [...AGENT_TEMPLATES]

// ─── BotTypeCard ──────────────────────────────────────────────────────────────

interface IBotTypeCardProps {
  botType: (typeof ALL_BOT_TYPES)[number]
  isInstalled: boolean
  isBuiltIn: boolean
  onInstall?: () => void
  onRemove?: () => void
}

function BotTypeCard({ botType, isInstalled, isBuiltIn, onInstall, onRemove }: IBotTypeCardProps): React.JSX.Element {
  const colorClass = botType.colorClass
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-[var(--color-surface)] p-5 transition-all ${
        isInstalled
          ? 'border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent-dim)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-2xl">
          {botType.icon}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${colorClass}`}>
          {botType.name}
        </span>
      </div>
      <p className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">{botType.name}</p>
      <p className="mb-4 flex-1 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
        {botType.description}
      </p>
      {isBuiltIn ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-muted)]">
          ● Built-in
        </span>
      ) : isInstalled ? (
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/50 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Installed
          </span>
          <button
            onClick={onRemove}
            className="rounded-lg border border-red-800/40 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/40"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          onClick={onInstall}
          className="w-full rounded-lg bg-[var(--color-accent-dim)] py-2 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
        >
          + Install
        </button>
      )}
    </div>
  )
}



/**
 * ModuleStore — Bot Type Store.
 * Everything is a bot. Browse and install downloadable bot types.
 * Built-in types are always available; catalog types must be installed.
 */
export function ModuleStore(): React.JSX.Element {
  const botTypeStore = useAgentTypesStore()
  const { installedTypeIds } = botTypeStore

  const [search, setSearch] = useState('')

  const BUILT_IN_IDS = new Set(AGENT_TEMPLATES.map((t) => t.id))

  const q = search.toLowerCase()
  const visibleBotTypes = ALL_BOT_TYPES.filter((t) => {
    return (
      q.length === 0 ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">

      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Bot Type Store</h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Every capability is a bot type. Install types to add them to your Bots tab.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-[var(--color-text-secondary)]">
              {String(installedTypeIds.length)} installed
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-6">

          {/* Search */}
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search bot types…"
              value={search}
              onChange={(e) => { setSearch(e.target.value) }}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* Built-in section */}
          {visibleBotTypes.some((t) => BUILT_IN_IDS.has(t.id)) && (
            <section>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Built-in
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {visibleBotTypes.filter((t) => BUILT_IN_IDS.has(t.id)).map((botType) => (
                  <BotTypeCard
                    key={botType.id}
                    botType={botType}
                    isInstalled={true}
                    isBuiltIn={true}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Downloadable section */}
          {visibleBotTypes.some((t) => !BUILT_IN_IDS.has(t.id)) && (
            <section>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Downloadable
              </p>
              {visibleBotTypes.filter((t) => !BUILT_IN_IDS.has(t.id)).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-2xl">🔍</p>
                  <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No results for &quot;{search}&quot;.</p>
                  <button onClick={() => { setSearch('') }} className="mt-3 text-xs text-[var(--color-accent)] hover:underline">Clear filters</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {visibleBotTypes.filter((t) => !BUILT_IN_IDS.has(t.id)).map((botType) => {
                    const isInstalled = installedTypeIds.includes(botType.id)
                    return (
                      <BotTypeCard
                        key={botType.id}
                        botType={botType}
                        isInstalled={isInstalled}
                        isBuiltIn={false}
                        onInstall={() => { botTypeStore.installType(botType.id) }}
                        onRemove={() => { botTypeStore.uninstallType(botType.id) }}
                      />
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {visibleBotTypes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-2xl">🔍</p>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No bot types match &quot;{search}&quot;.</p>
              <button onClick={() => { setSearch('') }} className="mt-3 text-xs text-[var(--color-accent)] hover:underline">Clear filters</button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
