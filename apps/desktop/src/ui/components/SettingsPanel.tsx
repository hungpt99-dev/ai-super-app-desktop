import React, { useEffect, useState } from 'react'
import { getDesktopBridge } from '../lib/bridge.js'
import { useAppStore, type Theme } from '../store/app-store.js'
import { usePermissionStore, PERMISSION_META, HIGH_RISK_PERMISSIONS } from '../store/permission-store.js'

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsTab = 'appearance' | 'notifications' | 'privacy' | 'permissions' | 'shortcuts' | 'about'

// ─── Constants ────────────────────────────────────────────────────────────────

const KEYBOARD_SHORTCUTS: { key: string; description: string; group: string }[] = [
  { group: 'Navigation', key: '⌘ 1',     description: 'Go to Chat' },
  { group: 'Navigation', key: '⌘ 2',     description: 'Go to Features' },
  { group: 'Navigation', key: '⌘ 3',     description: 'Go to Mini-App Store' },
  { group: 'Navigation', key: '⌘ ,',     description: 'Open Settings' },
  { group: 'Chat',       key: 'Enter',   description: 'Send message' },
  { group: 'Chat',       key: '⇧ Enter', description: 'New line in chat' },
  { group: 'Chat',       key: '⌘ K',     description: 'Clear chat history' },
  { group: 'General',    key: 'Esc',     description: 'Close / cancel' },
  { group: 'General',    key: '⌘ /',     description: 'Toggle keyboard shortcuts' },
]

const THEMES: { id: Theme; label: string; icon: string; description: string }[] = [
  { id: 'dark',   label: 'Dark',   icon: '🌙', description: 'Easy on the eyes at night' },
  { id: 'light',  label: 'Light',  icon: '☀️', description: 'Clean and bright' },
  { id: 'system', label: 'System', icon: '💻', description: 'Follows your OS setting' },
]

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
]

// ─── Shared layout ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
      {children}
    </p>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

function SettingRow({
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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
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

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' }): React.JSX.Element {
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

// ─── Tab: Appearance ─────────────────────────────────────────────────────────

function AppearanceTab(): React.JSX.Element {
  const appStore = useAppStore()
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>(() => {
    try { return (localStorage.getItem('ai-superapp-font-size') ?? 'md') as 'sm' | 'md' | 'lg' } catch { return 'md' }
  })
  const [reducedMotion, setReducedMotion] = useState(() => {
    try { return localStorage.getItem('ai-superapp-reduced-motion') === 'true' } catch { return false }
  })
  const [compactMode, setCompactMode] = useState(() => {
    try { return localStorage.getItem('ai-superapp-compact') === 'true' } catch { return false }
  })

  const handleThemeChange = (t: Theme): void => {
    appStore.setTheme(t)
    appStore.pushNotification({ title: 'Theme changed', body: `Switched to ${t} mode`, level: 'success' })
  }

  const handleFontSize = (s: 'sm' | 'md' | 'lg'): void => {
    setFontSize(s)
    try { localStorage.setItem('ai-superapp-font-size', s) } catch { /* ignore */ }
  }

  const handleReducedMotion = (v: boolean): void => {
    setReducedMotion(v)
    try { localStorage.setItem('ai-superapp-reduced-motion', String(v)) } catch { /* ignore */ }
  }

  const handleCompact = (v: boolean): void => {
    setCompactMode(v)
    try { localStorage.setItem('ai-superapp-compact', String(v)) } catch { /* ignore */ }
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
                'flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all',
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

// ─── Tab: Notifications ──────────────────────────────────────────────────────

function NotificationsTab(): React.JSX.Element {
  const [moduleNotifs, setModuleNotifs] = useState(true)
  const [agentUpdates, setAgentUpdates] = useState(true)
  const [systemAlerts, setSystemAlerts] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [desktopNotifs, setDesktopNotifs] = useState(true)

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Alert types</SectionTitle>
        <Card>
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
            label="Desktop notifications"
            description="Show native OS notifications when the app is in the background"
            control={<Toggle checked={desktopNotifs} onChange={setDesktopNotifs} />}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>}
            label="Mini-app notifications"
            description="Allow mini-apps to send in-app toast notifications"
            control={<Toggle checked={moduleNotifs} onChange={setModuleNotifs} />}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            label="Agent run updates"
            description="Notify when an AI agent completes or encounters an error"
            control={<Toggle checked={agentUpdates} onChange={setAgentUpdates} />}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
            label="System alerts"
            description="Connection errors, authentication issues, health warnings"
            control={<Toggle checked={systemAlerts} onChange={setSystemAlerts} />}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>}
            label="Sound effects"
            description="Play a subtle sound when a message is received"
            control={<Toggle checked={soundEnabled} onChange={setSoundEnabled} />}
            border={false}
          />
        </Card>
      </div>

      <div>
        <SectionTitle>Do not disturb</SectionTitle>
        <Card>
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            label="Quiet hours"
            description="Silence all notifications automatically during set hours"
            control={<Badge>Coming soon</Badge>}
            border={false}
          />
        </Card>
      </div>
    </div>
  )
}

// ─── Tab: Privacy ────────────────────────────────────────────────────────────

function PrivacyTab(): React.JSX.Element {
  const [telemetry, setTelemetry] = useState(false)
  const [crashReports, setCrashReports] = useState(false)
  const [localHistory, setLocalHistory] = useState(true)
  const [autoLock, setAutoLock] = useState(false)

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Data & analytics</SectionTitle>
        <Card>
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
            label="Usage analytics"
            description="Share anonymous usage data to help improve the app. No conversation content is included."
            control={<Toggle checked={telemetry} onChange={setTelemetry} />}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            label="Crash reports"
            description="Automatically send crash reports to help us fix bugs faster"
            control={<Toggle checked={crashReports} onChange={setCrashReports} />}
            border={false}
          />
        </Card>
      </div>

      <div>
        <SectionTitle>Local storage</SectionTitle>
        <Card>
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
            label="Save conversation history"
            description="Store chat history in local SQLite database on this device"
            control={<Toggle checked={localHistory} onChange={setLocalHistory} />}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>}
            label="Auto-lock after inactivity"
            description="Require authentication after the app has been idle"
            control={<Toggle checked={autoLock} onChange={setAutoLock} />}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>}
            label="Clear all conversation history"
            description="Permanently delete all stored messages from this device"
            control={
              <button className="rounded-lg border border-red-800/60 px-3 py-1.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-950/40">
                Clear
              </button>
            }
            danger
            border={false}
          />
        </Card>
      </div>

      <div>
        <SectionTitle>Security</SectionTitle>
        <Card>
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
            label="API key storage"
            description="Keys are stored in the OS keychain and never sent to any server"
            control={<Badge variant="success">Secure</Badge>}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
            label="Module sandboxing"
            description="All mini-apps run in an isolated permission-enforced sandbox"
            control={<Badge variant="success">Enabled</Badge>}
            border={false}
          />
        </Card>
      </div>
    </div>
  )
}

// ─── Tab: Permissions ────────────────────────────────────────────────────────

function PermissionsTab(): React.JSX.Element {
  const permStore = usePermissionStore()
  const entries = Object.entries(permStore.storedGrants)

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
              High-risk permissions (shell commands, file system) require your explicit approval each time a new mini-app is installed.
              Resetting a module clears its saved choice — you will be prompted again on next launch.
            </p>
          </div>
        </div>
      </div>

      {/* Granted list */}
      <div>
        <SectionTitle>Granted permissions</SectionTitle>
        {entries.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">No permissions granted yet</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Mini-apps you install will appear here</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {entries.map(([moduleId, perms]) => {
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
                        title="Clear saved permissions — will prompt again on next activation"
                      >
                        Reset
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
                              'rounded-md px-2 py-0.5 text-[10px] font-medium',
                              isHigh
                                ? 'bg-red-900/40 text-red-300 ring-1 ring-red-800/50'
                                : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]',
                            ].join(' ')}
                          >
                            {meta.label}
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

// ─── Tab: Shortcuts ──────────────────────────────────────────────────────────

function ShortcutsTab(): React.JSX.Element {
  const groups = [...new Set(KEYBOARD_SHORTCUTS.map((s) => s.group))]

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group}>
          <SectionTitle>{group}</SectionTitle>
          <Card>
            {KEYBOARD_SHORTCUTS.filter((s) => s.group === group).map((shortcut, i, arr) => (
              <div
                key={shortcut.key}
                className={`flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}
              >
                <span className="text-xs text-[var(--color-text-secondary)]">{shortcut.description}</span>
                <kbd className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 font-mono text-[10px] font-medium text-[var(--color-text-primary)] shadow-sm">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: About ──────────────────────────────────────────────────────────────

function AboutTab({ version }: { version: string }): React.JSX.Element {
  const isDev = Boolean(import.meta.env.DEV)

  return (
    <div className="space-y-5">
      {/* App identity */}
      <Card>
        <div className="flex items-center gap-4 border-b border-[var(--color-border)] px-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-purple-600 text-xl shadow-lg">
            🤖
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">AI SuperApp</p>
            <p className="text-xs text-[var(--color-text-muted)]">Your real AI assistant</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge variant={isDev ? 'warning' : 'success'}>{isDev ? '⚡ Development' : '🚀 Production'}</Badge>
              <Badge>v{version}</Badge>
            </div>
          </div>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {[
            { label: 'Version',        value: version },
            { label: 'Runtime',        value: 'Tauri 2 + Rust' },
            { label: 'UI',             value: 'React 18 + TypeScript' },
            { label: 'State',          value: 'Zustand' },
            { label: 'Local DB',       value: 'SQLite (via Tauri)' },
            { label: 'Architecture',   value: 'Agent on device + Cloud Gateway' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
              <span className="text-xs font-medium text-[var(--color-text-primary)]">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Links */}
      <div>
        <SectionTitle>Resources</SectionTitle>
        <Card>
          {[
            { label: 'Documentation',    icon: '📖', href: 'https://docs.ai-superapp.com' },
            { label: 'GitHub Repository', icon: '⬡',  href: 'https://github.com/ai-superapp/desktop' },
            { label: 'Report an issue',  icon: '🐛', href: 'https://github.com/ai-superapp/desktop/issues' },
            { label: 'Release notes',    icon: '📋', href: 'https://github.com/ai-superapp/desktop/releases' },
          ].map(({ label, icon, href }, i, arr) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--color-surface-2)] ${i < arr.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">{icon}</span>
                <span className="text-xs font-medium text-[var(--color-text-primary)]">{label}</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-muted)]">
                <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
              </svg>
            </a>
          ))}
        </Card>
      </div>

      {/* Legal */}
      <div>
        <SectionTitle>Legal</SectionTitle>
        <Card>
          <div className="px-4 py-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            AI SuperApp Desktop is open-source software released under the MIT License.
            AI responses are generated by third-party providers. We are not responsible for
            AI-generated content. Use responsibly.
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ISettingsPanelProps {
  onBack: () => void
}

/**
 * SettingsPanel — production-ready tabbed settings panel.
 * Tabs: Appearance · Notifications · Privacy · Permissions · Shortcuts · About
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
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
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

      <div className="flex h-0 flex-1 overflow-hidden">
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
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'appearance'    && <AppearanceTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'privacy'       && <PrivacyTab />}
          {activeTab === 'permissions'   && <PermissionsTab />}
          {activeTab === 'shortcuts'     && <ShortcutsTab />}
          {activeTab === 'about'         && <AboutTab version={version} />}
        </div>
      </div>
    </div>
  )
}
