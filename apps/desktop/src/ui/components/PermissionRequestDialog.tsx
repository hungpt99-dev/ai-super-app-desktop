import React, { useEffect, useState } from 'react'
import type { Permission } from '@ai-super-app/sdk'
import {
  usePermissionStore,
  PERMISSION_META,
  HIGH_RISK_PERMISSIONS,
} from '../store/permission-store.js'

// ── Icons ────────────────────────────────────────────────────────────────────

function ShieldIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function WarnIcon({ size = 13 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function CheckIcon(): React.JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ── Permission row ────────────────────────────────────────────────────────────

function PermissionRow({ permission }: { permission: Permission }): React.JSX.Element {
  const meta = PERMISSION_META[permission]
  const isHighRisk = HIGH_RISK_PERMISSIONS.has(permission)

  return (
    <div
      className={[
        'flex items-start gap-3 rounded-lg px-3 py-2.5',
        isHighRisk
          ? 'bg-red-950/40 border border-red-800/50'
          : 'bg-[var(--color-surface-2)]',
      ].join(' ')}
    >
      <div
        className={[
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          isHighRisk
            ? 'bg-red-900/60 text-red-400'
            : 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]',
        ].join(' ')}
      >
        {isHighRisk ? <WarnIcon /> : <CheckIcon />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={[
              'text-xs font-semibold',
              isHighRisk
                ? 'text-red-300'
                : 'text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            {meta.label}
          </span>
          {isHighRisk && (
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-900/60 text-red-400">
              High Risk
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
          {meta.description}
        </p>
      </div>
    </div>
  )
}

// ── Main dialog ───────────────────────────────────────────────────────────────

/**
 * PermissionRequestDialog — global modal that appears when a module requests
 * HIGH RISK permissions (computer.shell or computer.files).
 *
 * Mount once in App.tsx — it self-shows and self-hides based on the
 * permission store's `pending` state.
 */
export function PermissionRequestDialog(): React.JSX.Element | null {
  const permStore = usePermissionStore()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (permStore.pending) {
      const t = setTimeout(() => { setVisible(true) }, 16)
      return () => { clearTimeout(t) }
    } else {
      setVisible(false)
    }
  }, [permStore.pending])

  if (!permStore.pending) return null

  const highRiskPerms = permStore.pending.permissions.filter((p) =>
    HIGH_RISK_PERMISSIONS.has(p),
  )
  const standardPerms = permStore.pending.permissions.filter(
    (p) => !HIGH_RISK_PERMISSIONS.has(p),
  )

  const handleDeny = (): void => {
    setVisible(false)
    setTimeout(() => { permStore.deny() }, 150)
  }

  const handleApprove = (): void => {
    setVisible(false)
    setTimeout(() => { permStore.approve() }, 150)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-dialog-title"
      className={[
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-black/70 backdrop-blur-sm',
        'transition-opacity duration-150',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <div
        className={[
          'relative w-full max-w-md rounded-2xl',
          'border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl',
          'transition-transform duration-150',
          visible ? 'scale-100' : 'scale-95',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-900/40 text-amber-400">
            <ShieldIcon />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="perm-dialog-title"
              className="text-sm font-semibold text-[var(--color-text-primary)]"
            >
              Permission Request
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              <span className="font-medium text-[var(--color-text-primary)]">
                &ldquo;{permStore.pending.moduleName}&rdquo;
              </span>{' '}
              wants to access your system
            </p>
          </div>
        </div>

        {/* Permissions list */}
        <div className="px-5 py-4 space-y-3 max-h-72 overflow-y-auto">
          {highRiskPerms.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
                <WarnIcon /> High Risk
              </p>
              <div className="space-y-1.5">
                {highRiskPerms.map((p) => (
                  <PermissionRow key={p} permission={p} />
                ))}
              </div>
            </div>
          )}
          {standardPerms.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Standard
              </p>
              <div className="space-y-1.5">
                {standardPerms.map((p) => (
                  <PermissionRow key={p} permission={p} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Warning notice */}
        <div className="mx-5 mb-4 rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2.5">
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            High-risk permissions allow shell commands and full file system
            access on your machine. Only allow modules you trust completely.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[var(--color-border)] px-5 py-3.5">
          <button
            onClick={handleDeny}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-600"
          >
            Allow Access
          </button>
        </div>
      </div>
    </div>
  )
}
