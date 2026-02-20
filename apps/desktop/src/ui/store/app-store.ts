import { create } from 'zustand'
import type { IToastNotification } from '../../shared/bridge-types.js'

export type AppView = 'chat' | 'features' | 'store' | 'settings' | 'api-keys' | 'crypto' | 'writing-helper'
export type Theme = 'dark' | 'light' | 'system'
export type { IToastNotification }

interface IAppState {
  activeView: AppView
  notifications: IToastNotification[]
  theme: Theme
  setView(view: AppView): void
  setTheme(theme: Theme): void
  pushNotification(n: Omit<IToastNotification, 'id'>): void
  dismissNotification(id: string): void
}

const THEME_KEY = 'ai-superapp-theme'

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
  activeView: 'chat',
  notifications: [],
  theme: readSavedTheme(),

  setView: (view) => set({ activeView: view }),

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
    const id = `notif-${++notifCounter}-${Date.now()}`
    const notification: IToastNotification = { ...n, id }
    set((s) => ({ notifications: [...s.notifications, notification] }))
    // Auto-dismiss after 4.5 s
    setTimeout(() => {
      set((s) => ({ notifications: s.notifications.filter((t) => t.id !== id) }))
    }, 4500)
  },

  dismissNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((t) => t.id !== id) })),
}))

// Apply theme immediately when the module loads in the browser
applyTheme(readSavedTheme())
