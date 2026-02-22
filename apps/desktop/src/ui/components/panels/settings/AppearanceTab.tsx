import React, { useState } from 'react'
import { useAppStore, type Theme } from '../../../store/app-store.js'
import { Card, SectionTitle, SettingRow, Toggle } from './settings-shared.js'

const THEMES: { id: Theme; label: string; icon: string; description: string }[] = [
  { id: 'dark',   label: 'Dark',   icon: '🌙', description: 'Easy on the eyes at night' },
  { id: 'light',  label: 'Light',  icon: '☀️', description: 'Clean and bright' },
  { id: 'system', label: 'System', icon: '💻', description: 'Follows your OS setting' },
]

export function AppearanceTab(): React.JSX.Element {
  const appStore = useAppStore()
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>(() => {
    try { return (localStorage.getItem('agenthub-font-size') ?? 'md') as 'sm' | 'md' | 'lg' } catch { return 'md' }
  })
  const [reducedMotion, setReducedMotion] = useState(() => {
    try { return localStorage.getItem('agenthub-reduced-motion') === 'true' } catch { return false }
  })
  const [compactMode, setCompactMode] = useState(() => {
    try { return localStorage.getItem('agenthub-compact') === 'true' } catch { return false }
  })

  const handleThemeChange = (t: Theme): void => {
    appStore.setTheme(t)
    appStore.pushNotification({ title: 'Theme changed', body: `Switched to ${t} mode`, level: 'success' })
  }

  const handleFontSize = (s: 'sm' | 'md' | 'lg'): void => {
    setFontSize(s)
    try {
      localStorage.setItem('agenthub-font-size', s)
      document.documentElement.setAttribute('data-font-size', s)
    } catch { /* ignore */ }
  }

  const handleReducedMotion = (v: boolean): void => {
    setReducedMotion(v)
    try {
      localStorage.setItem('agenthub-reduced-motion', String(v))
      document.documentElement.setAttribute('data-reduced-motion', String(v))
    } catch { /* ignore */ }
  }

  const handleCompact = (v: boolean): void => {
    setCompactMode(v)
    try {
      localStorage.setItem('agenthub-compact', String(v))
      document.documentElement.setAttribute('data-compact', String(v))
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-5">
      {/* Theme */}
      <div>
        <SectionTitle>Color theme</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map(({ id, label, icon, description }) => (
            <button
              key={id}
              onClick={() => { handleThemeChange(id) }}
              className={[
                'relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all',
                appStore.theme === id
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50',
              ].join(' ')}
            >
              <span className="text-2xl">{icon}</span>
              <div>
                <p className={`text-xs font-semibold ${appStore.theme === id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>{label}</p>
                <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{description}</p>
              </div>
              {appStore.theme === id && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div>
        <SectionTitle>Font size</SectionTitle>
        <Card>
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>}
            label="Chat font size"
            description="Controls the text size in the chat window"
            control={
              <div className="flex gap-1">
                {(['sm', 'md', 'lg'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => { handleFontSize(s) }}
                    className={[
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      fontSize === s
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]',
                    ].join(' ')}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            }
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18"/></svg>}
            label="Compact mode"
            description="Reduce spacing between messages and UI elements"
            control={<Toggle checked={compactMode} onChange={handleCompact} />}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            label="Reduce motion"
            description="Minimize animations and transitions throughout the app"
            control={<Toggle checked={reducedMotion} onChange={handleReducedMotion} />}
            border={false}
          />
        </Card>
      </div>
    </div>
  )
}
