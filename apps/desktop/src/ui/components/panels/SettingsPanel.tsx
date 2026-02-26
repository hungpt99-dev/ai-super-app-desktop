/**
 * SettingsPanel.tsx
 *
 * Thin shell — layout, tab routing, and version loading only.
 * All tab content lives in the settings/ sub-folder.
 */

import React, { useEffect, useState } from 'react'
import { getDesktopBridge } from '../../lib/bridge.js'
import {
  AppearanceTab,
  NotificationsTab,
  PrivacyTab,
  PermissionsTab,
  ShortcutsTab,
  AboutTab,
  DeveloperTab,
} from './settings/index.js'

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsTab =
  | 'appearance'
  | 'notifications'
  | 'privacy'
  | 'permissions'
  | 'shortcuts'
  | 'about'
  | 'developer'

// ─── Tab registry ─────────────────────────────────────────────────────────────

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    id: 'privacy',
    label: 'Privacy',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    id: 'permissions',
    label: 'Permissions',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    id: 'about',
    label: 'About',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    id: 'developer',
    label: 'Developer',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
]

// ─── Main component ───────────────────────────────────────────────────────────

interface ISettingsPanelProps {
  onBack: () => void
}

/**
 * SettingsPanel — tabbed settings panel.
 * Tabs: Appearance · Notifications · Privacy · Permissions · Shortcuts · About · Developer
 */
export function SettingsPanel({ onBack }: ISettingsPanelProps): React.JSX.Element {
  const [version, setVersion] = useState('…')
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')

  useEffect(() => {
    void getDesktopBridge()
      .app.version()
      .then(setVersion)
      .catch(() => { setVersion('1.0.0') })
  }, [])

  return (
    <div className="flex h-full w-full flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3.5">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Settings</h2>
          <p className="text-[11px] text-[var(--color-text-muted)]">Manage your preferences and app configuration</p>
        </div>
      </div>

      <div className="flex flex-1 h-0 overflow-hidden">
        {/* Sidebar nav */}
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-2">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id) }}
              className={[
                'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors',
                activeTab === id
                  ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              <span className={activeTab === id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}>
                {icon}
              </span>
              {label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="flex-1 p-5 overflow-x-hidden overflow-y-auto">
          {activeTab === 'appearance'    && <AppearanceTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'privacy'       && <PrivacyTab />}
          {activeTab === 'permissions'   && <PermissionsTab />}
          {activeTab === 'shortcuts'     && <ShortcutsTab />}
          {activeTab === 'about'         && <AboutTab version={version} />}
          {activeTab === 'developer'     && <DeveloperTab />}
        </div>
      </div>
    </div>
  )
}
