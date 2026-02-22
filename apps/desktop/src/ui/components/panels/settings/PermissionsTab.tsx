import React, { useState } from 'react'
import { Permission } from '@agenthub/sdk'
import { usePermissionStore, PERMISSION_META, HIGH_RISK_PERMISSIONS } from '../../../store/permission-store.js'
import { Badge, Card, SectionTitle, SettingRow, Toggle } from './settings-shared.js'

export function PermissionsTab(): React.JSX.Element {
  const permStore = usePermissionStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'high-risk' | 'standard'>('all')
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false)

  const allEntries = Object.entries(permStore.storedGrants)
  const totalAgents = allEntries.length
  const totalStandard = allEntries.reduce((n, [, ps]) => n + ps.filter((p) => !HIGH_RISK_PERMISSIONS.has(p)).length, 0)
  const totalHighRisk = allEntries.reduce((n, [, ps]) => n + ps.filter((p) => HIGH_RISK_PERMISSIONS.has(p)).length, 0)

  const filteredEntries = allEntries.filter(([moduleId, perms]) => {
    if (search.length > 0 && !moduleId.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'high-risk') return perms.some((p) => HIGH_RISK_PERMISSIONS.has(p))
    if (filter === 'standard') return perms.every((p) => !HIGH_RISK_PERMISSIONS.has(p))
    return true
  })

  const handleRevokeAll = (): void => {
    if (!confirmRevokeAll) { setConfirmRevokeAll(true); return }
    permStore.revokeAll()
    setConfirmRevokeAll(false)
  }

  return (
    <div className="space-y-5">
      {/* Explainer */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-900/30 text-amber-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">How permissions work</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              Standard permissions (AI, storage, notifications) are approved automatically.
              High-risk permissions (shell commands, file system) require your explicit approval each time a new agent is activated.
              Resetting a module clears its saved choice — you will be prompted again on next launch.
            </p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {totalAgents > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3">
            <span className="text-base font-bold text-[var(--color-text-primary)]">{String(totalAgents)}</span>
            <span className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{totalAgents !== 1 ? 'agents' : 'agent'} granted</span>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3">
            <span className="text-base font-bold text-[var(--color-text-primary)]">{String(totalStandard)}</span>
            <span className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">standard</span>
          </div>
          <div className={`flex flex-col items-center rounded-xl border py-3 ${totalHighRisk > 0 ? 'border-red-800/50 bg-red-900/20' : 'border-[var(--color-border)] bg-[var(--color-surface)]'
            }`}>
            <span className={`text-base font-bold ${totalHighRisk > 0 ? 'text-red-300' : 'text-[var(--color-text-primary)]'}`}>
              {String(totalHighRisk)}
            </span>
            <span className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">high-risk</span>
          </div>
        </div>
      )}

      {/* Global kill switches */}
      <div>
        <SectionTitle>Global blocks</SectionTitle>
        <Card>
          <SettingRow
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            }
            label="Block shell commands"
            description={
              permStore.blockedPermissions.has(Permission.ComputerShell)
                ? 'Globally blocked — no agent can run shell commands on your machine'
                : 'Allow agents with shell permission to run commands on your machine'
            }
            control={
              <Toggle
                checked={permStore.blockedPermissions.has(Permission.ComputerShell)}
                onChange={() => { permStore.toggleBlock(Permission.ComputerShell) }}
              />
            }
            danger={permStore.blockedPermissions.has(Permission.ComputerShell)}
          />
          <SettingRow
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            }
            label="Block file system access"
            description={
              permStore.blockedPermissions.has(Permission.ComputerFiles)
                ? 'Globally blocked — no agent can access your file system'
                : 'Allow agents with file permission to read and write files on your machine'
            }
            control={
              <Toggle
                checked={permStore.blockedPermissions.has(Permission.ComputerFiles)}
                onChange={() => { permStore.toggleBlock(Permission.ComputerFiles) }}
              />
            }
            danger={permStore.blockedPermissions.has(Permission.ComputerFiles)}
            border={false}
          />
        </Card>
      </div>

      {/* Granted permissions */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Granted permissions</p>
          {allEntries.length > 0 && (
            <button
              onClick={handleRevokeAll}
              onBlur={() => { setConfirmRevokeAll(false) }}
              className={`text-[10px] font-medium transition-colors ${confirmRevokeAll
                  ? 'text-red-400 underline'
                  : 'text-[var(--color-text-muted)] hover:text-red-400'
                }`}
            >
              {confirmRevokeAll ? '⚠ Confirm revoke all?' : 'Revoke all'}
            </button>
          )}
        </div>

        {allEntries.length > 0 && (
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search agents…"
                value={search}
                onChange={(e) => { setSearch(e.target.value) }}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-8 pr-3 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none transition-colors focus:border-[var(--color-accent)]"
              />
            </div>
            <div className="flex shrink-0 gap-1.5">
              {(['all', 'high-risk', 'standard'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f) }}
                  className={[
                    'rounded-lg px-2.5 py-1.5 text-[10px] font-medium capitalize transition-colors',
                    filter === f
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/50',
                  ].join(' ')}
                >
                  {f === 'all' ? 'All' : f === 'high-risk' ? 'High risk' : 'Standard'}
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredEntries.length === 0 && allEntries.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">No permissions granted yet</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Agents you activate will appear here</p>
            </div>
          </Card>
        ) : filteredEntries.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <p className="text-xs text-[var(--color-text-secondary)]">No agents match this filter</p>
              <button
                onClick={() => { setSearch(''); setFilter('all') }}
                className="text-[10px] text-[var(--color-accent)] hover:underline"
              >
                Clear filter
              </button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map(([moduleId, perms]) => {
              const highRisk = perms.filter((p) => HIGH_RISK_PERMISSIONS.has(p))
              return (
                <Card key={moduleId}>
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-xs">
                        📦
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-text-primary)]">{moduleId}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">{perms.length} permission{perms.length !== 1 ? 's' : ''} granted</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {highRisk.length > 0 && <Badge variant="danger">⚠ High risk</Badge>}
                      <button
                        onClick={() => { permStore.revokeStored(moduleId) }}
                        className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-red-700 hover:bg-red-950/30 hover:text-red-400"
                        title="Clear all permissions for this agent — will prompt again on next activation"
                      >
                        Reset all
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {perms.map((p) => {
                        const isHigh = HIGH_RISK_PERMISSIONS.has(p)
                        const meta = PERMISSION_META[p]
                        return (
                          <span
                            key={p}
                            title={meta.description}
                            className={[
                              'group flex items-center gap-1 rounded-md py-0.5 pl-2 pr-1 text-[10px] font-medium',
                              isHigh
                                ? 'bg-red-900/40 text-red-300 ring-1 ring-red-800/50'
                                : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]',
                            ].join(' ')}
                          >
                            {meta.label}
                            <button
                              onClick={() => { permStore.revokePermission(moduleId, p) }}
                              title={`Revoke ${meta.label}`}
                              aria-label={`Revoke ${meta.label}`}
                              className={[
                                'rounded-sm opacity-0 transition-opacity group-hover:opacity-100',
                                isHigh
                                  ? 'text-red-400 hover:text-red-200'
                                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                              ].join(' ')}
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
