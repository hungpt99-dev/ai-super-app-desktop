/**
 * settings-shared.tsx
 *
 * Shared primitive components used across every Settings tab.
 * Import from here, not from SettingsPanel.tsx.
 */

import React from 'react'

// ─── SectionTitle ─────────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
      {children}
    </p>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

// ─── SettingRow ───────────────────────────────────────────────────────────────

export function SettingRow({
  icon,
  label,
  description,
  control,
  danger = false,
  border = true,
}: {
  icon?: React.ReactNode
  label: string
  description?: string
  control: React.ReactNode
  danger?: boolean
  border?: boolean
}): React.JSX.Element {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${border ? 'border-b border-[var(--color-border)] last:border-b-0' : ''}`}>
      {icon && (
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${danger ? 'bg-red-950/50 text-red-400' : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]'}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-medium ${danger ? 'text-red-400' : 'text-[var(--color-text-primary)]'}`}>
          {label}
        </p>
        {description && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-muted)]">{description}</p>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => { onChange(!checked) }}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
        checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-2)] border border-[var(--color-border)]',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' }): React.JSX.Element {
  const STYLES: Record<'default' | 'success' | 'warning' | 'danger', string> = {
    default: 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]',
    success: 'bg-emerald-900/50 text-emerald-400',
    warning: 'bg-amber-900/50 text-amber-400',
    danger:  'bg-red-900/50 text-red-400',
  }
  return (
    <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${STYLES[variant]}`}>
      {children}
    </span>
  )
}
