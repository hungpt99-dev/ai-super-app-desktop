import React, { useEffect, useState } from 'react'
import { getDesktopBridge } from '../lib/bridge.js'
import { useAppStore, type Theme } from '../store/app-store.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const KEYBOARD_SHORTCUTS: Array<{ key: string; description: string }> = [
  { key: '⌘ 1',     description: 'Go to Chat' },
  { key: '⌘ 2',     description: 'Go to Features' },
  { key: '⌘ 3',     description: 'Go to Store' },
  { key: '⌘ ,',     description: 'Open Settings' },
  { key: 'Enter',   description: 'Send message' },
  { key: '⇧ Enter', description: 'New line in chat' },
  { key: 'Esc',     description: 'Close / cancel' },
]

const THEMES: Array<{ id: Theme; label: string; icon: string }> = [
  { id: 'dark',   label: 'Dark',   icon: '🌙' },
  { id: 'light',  label: 'Light',  icon: '☀️' },
  { id: 'system', label: 'System', icon: '💻' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {title}
      </p>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-xs font-medium text-[var(--color-text-primary)]">{value}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ISettingsPanelProps {
  onBack: () => void
}

/**
 * SettingsPanel — app-level settings: theme, shortcuts, about info.
 */
export function SettingsPanel({ onBack }: ISettingsPanelProps): React.JSX.Element {
  const [version, setVersion] = useState('…')
  const { theme, setTheme, pushNotification } = useAppStore()

  useEffect(() => {
    void getDesktopBridge()
      .app.version()
      .then(setVersion)
      .catch(() => setVersion('N/A'))
  }, [])

  const handleThemeChange = (t: Theme) => {
    setTheme(t)
    pushNotification({
      title: 'Theme changed',
      body: `Switched to ${t} mode`,
      level: 'success',
    })
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-sm">
          ⚙️
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Settings</h2>
          <p className="text-xs text-[var(--color-text-muted)]">Customize your experience</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Appearance */}
        <Section title="Appearance">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Theme</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                Choose your preferred color scheme
              </p>
            </div>
            <div className="flex gap-1.5">
              {THEMES.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => handleThemeChange(id)}
                  className={[
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    theme === id
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]',
                  ].join(' ')}
                >
                  <span>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Keyboard Shortcuts */}
        <Section title="Keyboard Shortcuts">
          <div className="space-y-0.5">
            {KEYBOARD_SHORTCUTS.map(({ key, description }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-[var(--color-surface-2)]"
              >
                <span className="text-xs text-[var(--color-text-secondary)]">{description}</span>
                <kbd className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-text-primary)]">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </Section>

        {/* About */}
        <Section title="About">
          <div className="space-y-0.5">
            <InfoRow label="Version" value={version} />
            <InfoRow label="Architecture" value="Desktop + Cloud Gateway" />
            <InfoRow label="UI Framework" value="Electron + React 18" />
            <InfoRow label="State" value="Zustand" />
            <InfoRow
              label="Mode"
              value={import.meta.env.DEV ? '⚡ Development (Mock Bridge)' : '🚀 Production'}
            />
          </div>
        </Section>

      </div>
    </div>
  )
}
