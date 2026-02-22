import React, { useState } from 'react'
import { useAgentsStore } from '../../../store/agents-store.js'
import { Badge, Card, SectionTitle, SettingRow, Toggle } from './settings-shared.js'

export function PrivacyTab(): React.JSX.Element {
  const [telemetry, setTelemetry] = useState(false)
  const [crashReports, setCrashReports] = useState(false)
  const [localHistory, setLocalHistory] = useState(true)
  const [autoLock, setAutoLock] = useState(false)
  const [historyCleared, setHistoryCleared] = useState(false)

  const handleClearHistory = (): void => {
    useAgentsStore.getState().clearAllChats()
    setHistoryCleared(true)
    setTimeout(() => { setHistoryCleared(false) }, 2_000)
  }

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Data &amp; analytics</SectionTitle>
        <Card>
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
            label="Usage analytics"
            description="Share anonymous usage data to help improve the app. No conversation content is included."
            control={<Toggle checked={telemetry} onChange={setTelemetry} />}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
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
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
            label="Save conversation history"
            description="Store chat history in local SQLite database on this device"
            control={<Toggle checked={localHistory} onChange={setLocalHistory} />}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>}
            label="Auto-lock after inactivity"
            description="Require authentication after the app has been idle"
            control={<Toggle checked={autoLock} onChange={setAutoLock} />}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>}
            label="Clear all conversation history"
            description="Permanently delete all stored messages from this device"
            control={
              <button
                onClick={handleClearHistory}
                className="rounded-lg border border-red-800/60 px-3 py-1.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-950/40">
                {historyCleared ? '✓ Cleared' : 'Clear'}
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
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
            label="API key storage"
            description="Keys are stored in the OS keychain and never sent to any server"
            control={<Badge variant="success">Secure</Badge>}
          />
          <SettingRow
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
            label="Module sandboxing"
            description="All agents run in an isolated permission-enforced sandbox"
            control={<Badge variant="success">Enabled</Badge>}
            border={false}
          />
        </Card>
      </div>
    </div>
  )
}
