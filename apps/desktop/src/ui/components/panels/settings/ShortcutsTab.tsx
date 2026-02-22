import React from 'react'
import { Card, SectionTitle } from './settings-shared.js'

const KEYBOARD_SHORTCUTS: { key: string; description: string; group: string }[] = [
  { group: 'Navigation', key: '⌘ 1', description: 'Go to Chat' },
  { group: 'Navigation', key: '⌘ 2', description: 'Go to Agents' },
  { group: 'Navigation', key: '⌘ 3', description: 'Go to Activity' },
  { group: 'Navigation', key: '⌘ ,', description: 'Open Settings' },
  { group: 'Chat', key: 'Enter', description: 'Send message' },
  { group: 'Chat', key: '⇧ Enter', description: 'New line in chat' },
  { group: 'Chat', key: '⌘ K', description: 'Clear chat history' },
  { group: 'General', key: 'Esc', description: 'Close / cancel' },
  { group: 'General', key: '⌘ /', description: 'Toggle keyboard shortcuts' },
]

export function ShortcutsTab(): React.JSX.Element {
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
