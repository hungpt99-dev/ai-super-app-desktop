import React from 'react'
import { useModuleStore } from '../store/module-store.js'

/**
 * ModuleStore — internal module management screen.
 * Lists installed modules, allows uninstall.
 */
export function ModuleStore(): React.JSX.Element {
  const { modules, isLoading, uninstall } = useModuleStore()

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Installed Features
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          Manage your active AI features.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Stats row */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: 'Installed', value: isLoading ? '…' : String(modules.length) },
            { label: 'AI Models', value: '3' },
            { label: 'Status', value: 'Active' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                {stat.label}
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Module list */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
            Loading features…
          </div>
        )}

        {!isLoading && modules.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-surface-2)] text-3xl">
              ⚡
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              No features installed yet
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Go to the Features tab to add your first feature.
            </p>
          </div>
        )}

        {modules.length > 0 && (
          <div className="space-y-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Active ({modules.length})
            </p>
            {modules.map((mod) => (
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
                    onClick={() => void uninstall(mod.id)}
                    className="rounded-lg border border-red-800/40 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/40"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
