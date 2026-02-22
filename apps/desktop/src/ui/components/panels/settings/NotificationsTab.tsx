import React, { useState } from 'react'
import { Badge, Card, SectionTitle, SettingRow, Toggle } from './settings-shared.js'

export function NotificationsTab(): React.JSX.Element {
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
            label="Bot notifications"
            description="Allow bots to send in-app toast notifications"
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
