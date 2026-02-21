import React, { useState } from 'react'
import { useModuleStore } from '../store/module-store.js'

// ─── Catalog ──────────────────────────────────────────────────────────────────

interface ICatalogApp {
  id: string
  icon: string
  name: string
  description: string
  category: string
  categoryColor: string
  version: string
  author: string
}

const CATALOG: ICatalogApp[] = [
  {
    id: 'crypto',
    icon: '📈',
    name: 'Crypto Analysis',
    description: 'Real-time price tracking, portfolio overview, and AI-powered market insights.',
    category: 'Finance',
    categoryColor: 'bg-yellow-400/15 text-yellow-400',
    version: '1.2.0',
    author: 'AI SuperApp',
  },
  {
    id: 'writing-helper',
    icon: '✍️',
    name: 'Writing Helper',
    description: 'Improve, summarize, expand, translate, or fix grammar in any text with AI.',
    category: 'Productivity',
    categoryColor: 'bg-blue-400/15 text-blue-400',
    version: '1.1.0',
    author: 'AI SuperApp',
  },
  {
    id: 'code-review',
    icon: '🔍',
    name: 'Code Reviewer',
    description: 'Automated code review with suggestions for bugs, style, and performance.',
    category: 'Development',
    categoryColor: 'bg-violet-400/15 text-violet-400',
    version: '0.9.0',
    author: 'AI SuperApp',
    },
  {
    id: 'data-viz',
    icon: '📊',
    name: 'Data Visualizer',
    description: 'Turn CSV or JSON data into beautiful charts and summaries instantly.',
    category: 'Productivity',
    categoryColor: 'bg-blue-400/15 text-blue-400',
    version: '0.8.0',
    author: 'AI SuperApp',
  },
  {
    id: 'email-composer',
    icon: '📧',
    name: 'Email Composer',
    description: 'Draft professional emails from bullet points. Tone, length, and style controls.',
    category: 'Productivity',
    categoryColor: 'bg-blue-400/15 text-blue-400',
    version: '1.0.0',
    author: 'AI SuperApp',
  },
  {
    id: 'meeting-notes',
    icon: '📝',
    name: 'Meeting Notes',
    description: 'Summarise meeting transcripts, extract action items, and draft follow-ups.',
    category: 'Automation',
    categoryColor: 'bg-emerald-400/15 text-emerald-400',
    version: '1.0.0',
    author: 'AI SuperApp',
  },
]

const ALL_CATEGORIES = ['All', ...Array.from(new Set(CATALOG.map((a) => a.category)))]

// ─── ModuleStore ──────────────────────────────────────────────────────────────

/**
 * ModuleStore — Mini-App Store.
 * Browse available mini-apps and manage installed ones.
 */
export function ModuleStore(): React.JSX.Element {
  const modStore = useModuleStore()
  const { modules, isLoading } = modStore

  const [search, setSearch]       = useState('')
  const [category, setCategory]   = useState('All')

  const installedIds = new Set(modules.map((m) => m.id))

  const q = search.toLowerCase()
  const visibleApps = CATALOG.filter((app) => {
    const matchesSearch =
      q.length === 0 ||
      app.name.toLowerCase().includes(q) ||
      app.description.toLowerCase().includes(q) ||
      app.category.toLowerCase().includes(q)
    const matchesCategory = category === 'All' || app.category === category
    return matchesSearch && matchesCategory
  })

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">

      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Mini-App Store</h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Browse and install AI-powered mini-apps.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-[var(--color-text-secondary)]">
              {isLoading ? '…' : String(modules.length)} installed
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-6">

          {/* Search + category filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search mini-apps…"
                value={search}
                onChange={(e) => { setSearch(e.target.value) }}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setCategory(cat) }}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === cat
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog grid */}
          {visibleApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-2xl">🔍</p>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No apps match &quot;{search}&quot;.</p>
              <button
                onClick={() => { setSearch(''); setCategory('All') }}
                className="mt-3 text-xs text-[var(--color-accent)] hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <section>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {category === 'All' ? 'All Apps' : category} ({visibleApps.length})
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {visibleApps.map((app) => {
                  const installed = installedIds.has(app.id)
                  return (
                    <div
                      key={app.id}
                      className={`flex flex-col rounded-2xl border bg-[var(--color-surface)] p-5 transition-all ${
                        installed
                          ? 'border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent-dim)]'
                          : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-2xl">
                          {app.icon}
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${app.categoryColor}`}>
                          {app.category}
                        </span>
                      </div>
                      <p className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">{app.name}</p>
                      <p className="mb-1 flex-1 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                        {app.description}
                      </p>
                      <p className="mb-4 text-[10px] text-[var(--color-text-muted)]">
                        v{app.version} · {app.author}
                      </p>
                      {installed ? (
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/50 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Installed
                          </span>
                          <button
                            onClick={() => { void modStore.uninstall(app.id) }}
                            className="rounded-lg border border-red-800/40 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/40"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled
                          title="Coming soon"
                          className="w-full cursor-not-allowed rounded-lg border border-dashed border-[var(--color-border)] py-2 text-xs text-[var(--color-text-muted)]"
                        >
                          Coming soon
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Installed modules not in catalog */}
          {(() => {
            const uncataloged = modules.filter((m) => !CATALOG.some((c) => c.id === m.id))
            if (uncataloged.length === 0) return null
            return (
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Other Installed ({uncataloged.length})
                </p>
                <div className="space-y-2">
                  {uncataloged.map((mod) => (
                    <div
                      key={mod.id}
                      className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 transition-colors hover:border-[var(--color-border)]/80"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-lg">
                          📦
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{mod.name}</p>
                          <p className="text-[11px] text-[var(--color-text-secondary)]">v{mod.version}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/50 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                        <button
                          onClick={() => { void modStore.uninstall(mod.id) }}
                          className="rounded-lg border border-red-800/40 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/40"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })()}

        </div>
      </div>
    </div>
  )
}
