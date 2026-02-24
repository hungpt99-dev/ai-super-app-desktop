import { create } from 'zustand'
import type { IToastNotification } from '../../bridges/bridge-types.js'
import { addLog } from './log-store.js'

export type AppView = 'dashboard' | 'chat' | 'agents' | 'hub' | 'activity' | 'logs' | 'settings' | 'api-keys' | 'agent-run' | 'create-agent' | 'create-skill' | 'agent-marketplace' | 'skill-marketplace'
  | 'execution-playground' | 'agent-builder' | 'skill-builder' | 'agent-library' | 'skill-library' | 'snapshot-manager'
export type Theme = 'dark' | 'light' | 'system'
export type { IToastNotification }

/** Persisted notification entry shown in the notification center. */
export interface INotificationEntry {
  id: string
  title: string
  body: string
  level: IToastNotification['level']
  /** Optional source label — e.g. agent name. */
  source?: string
  timestamp: number
  read: boolean
}

interface IAppState {
  activeView: AppView
  /** Live toasts (auto-dismissed after 4.5 s). */
  notifications: IToastNotification[]
  /** Persistent history shown in the notification center (max 100 entries). */
  notificationHistory: INotificationEntry[]
  /** Count of unread notifications. */
  unreadCount: number
  theme: Theme
  setView: (view: AppView) => void
  setTheme: (theme: Theme) => void
  pushNotification: (n: Omit<IToastNotification, 'id'> & { source?: string }) => void
  dismissNotification: (id: string) => void
  markAllRead: () => void
  clearHistory: () => void
}

const THEME_KEY = 'agenthub-theme'

function readSavedTheme(): Theme {
  try {
    return (localStorage.getItem(THEME_KEY) as Theme | null) ?? 'dark'
  } catch {
    return 'dark'
  }
}

function applyTheme(theme: Theme): void {
  try {
    const prefersDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  } catch {
    // Not in a browser context (e.g. tests)
  }
}

let notifCounter = 0

export const useAppStore = create<IAppState>((set) => ({
  activeView: 'dashboard' as AppView,
  notifications: [],
  notificationHistory: [],
  unreadCount: 0,
  theme: readSavedTheme(),

  setView: (view) => { set({ activeView: view }) },

  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore in non-browser contexts */
    }
    applyTheme(theme)
    set({ theme })
  },

  pushNotification: (n) => {
    const id = `notif-${String(++notifCounter)}-${String(Date.now())}`
    const toast: IToastNotification = { id, title: n.title, body: n.body, level: n.level }
    const entry: INotificationEntry = {
      id,
      title: n.title,
      body: n.body,
      level: n.level,
      ...(n.source !== undefined ? { source: n.source } : {}),
      timestamp: Date.now(),
      read: false,
    }
    // Mirror warn / error notifications to the Logs panel.
    if (n.level === 'error' || n.level === 'warning') {
      addLog({ level: n.level === 'warning' ? 'warn' : 'error', source: 'system', message: n.title, ...(n.body ? { detail: n.body } : {}) })
    }
    set((s) => ({
      notifications: [...s.notifications, toast],
      notificationHistory: [entry, ...s.notificationHistory].slice(0, 100),
      unreadCount: s.unreadCount + 1,
    }))
    // Auto-dismiss toast after 4.5 s
    setTimeout(() => {
      set((s) => ({ notifications: s.notifications.filter((t) => t.id !== id) }))
    }, 4500)
  },

  dismissNotification: (id) => { set((s) => ({ notifications: s.notifications.filter((t) => t.id !== id) })) },

  markAllRead: () => {
    set((s) => ({
      notificationHistory: s.notificationHistory.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },

  clearHistory: () => { set({ notificationHistory: [], unreadCount: 0 }) },
}))

// Apply theme immediately when the module loads in the browser
applyTheme(readSavedTheme())

// Re-apply when the OS preference changes and the user has 'system' selected
try {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (readSavedTheme() === 'system') applyTheme('system')
  })
} catch {
  /* Not in a browser context — e.g. unit tests */
}
