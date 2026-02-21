/**
 * notification-store.ts
 *
 * Global notification state for the web dashboard.
 *
 * Any component, page, or store can call the exported `notifyWeb()`
 * helper to push a notification without importing the full store.
 *
 * Mini-apps trigger notifications through ctx.ui.notify() on the
 * desktop; on the web, agents (bots) and UI actions drive them here.
 */

import { create } from 'zustand'

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

/** Persistent notification entry — shown in the notification center + as a toast. */
export interface IWebNotification {
  id: string
  title: string
  body: string
  level: NotificationLevel
  /** Optional source label, e.g. "Writing Helper" or "Trading Bot". */
  source?: string
  timestamp: number
  read: boolean
}

interface INotificationStore {
  /** Persistent history (max 100). */
  history: IWebNotification[]
  /** Live toasts currently on screen (auto-removed after 4.5 s). */
  toasts: IWebNotification[]
  /** Count of unread history entries. */
  unreadCount: number

  /** Push a new notification (appears as a toast + is added to history). */
  push(n: Omit<IWebNotification, 'id' | 'timestamp' | 'read'>): void
  /** Dismiss a specific live toast. */
  dismissToast(id: string): void
  /** Mark all history entries as read (called when the center is opened). */
  markAllRead(): void
  /** Clear entire notification history. */
  clearHistory(): void
}

let counter = 0

export const useNotificationStore = create<INotificationStore>((set) => ({
  history: [],
  toasts: [],
  unreadCount: 0,

  push: (n) => {
    const id = `wn-${String(++counter)}-${String(Date.now())}`
    const entry: IWebNotification = {
      id,
      title: n.title,
      body: n.body,
      level: n.level,
      ...(n.source !== undefined ? { source: n.source } : {}),
      timestamp: Date.now(),
      read: false,
    }
    set((s) => ({
      history: [entry, ...s.history].slice(0, 100),
      toasts: [...s.toasts, entry],
      unreadCount: s.unreadCount + 1,
    }))
    // Auto-remove toast after 4.5 s
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4500)
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  markAllRead: () => {
    set((s) => ({
      history: s.history.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },

  clearHistory: () => { set({ history: [], unreadCount: 0 }) },
}))

/**
 * notifyWeb — push a notification from anywhere (stores, hooks, pages).
 * Import this instead of the full store when you only need to send.
 *
 * @example
 *   notifyWeb({ title: 'Bot completed', body: 'My Bot finished successfully.', level: 'success', source: 'My Bot' })
 */
export function notifyWeb(
  n: Omit<IWebNotification, 'id' | 'timestamp' | 'read'>,
): void {
  useNotificationStore.getState().push(n)
}
