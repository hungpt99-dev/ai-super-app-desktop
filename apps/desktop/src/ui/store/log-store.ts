/**
 * log-store.ts
 *
 * In-memory ring-buffer for structured application logs.
 * Feeds the Logs tab in the sidebar. Never persisted to disk.
 */

import { create } from 'zustand'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogSource = 'system' | 'chat' | 'ai' | 'bot' | 'agent' | 'auth' | 'group-chat'

export interface ILogEntry {
  id: string
  /** Unix epoch ms */
  ts: number
  level: LogLevel
  source: LogSource
  message: string
  /** Optional extra context — JSON string, stack trace, response body, etc. */
  detail?: string
}

interface ILogState {
  entries: ILogEntry[]
  addLog: (entry: Omit<ILogEntry, 'id' | 'ts'>) => void
  clear: () => void
}

/** Maximum number of entries kept in memory (ring buffer). */
const MAX_ENTRIES = 2_000

let _counter = 0

export const useLogStore = create<ILogState>((set) => ({
  entries: [],

  addLog: (entry) => {
    const id = `log-${String(Date.now())}-${String(++_counter)}`
    const newEntry: ILogEntry = { ...entry, id, ts: Date.now() }
    set((s) => ({
      entries:
        s.entries.length >= MAX_ENTRIES
          ? [...s.entries.slice(s.entries.length - MAX_ENTRIES + 1), newEntry]
          : [...s.entries, newEntry],
    }))
  },

  clear: () => { set({ entries: [] }) },
}))

/**
 * Module-level helper so other stores can call `addLog(...)` without
 * importing the full Zustand store.
 */
export function addLog(entry: Omit<ILogEntry, 'id' | 'ts'>): void {
  useLogStore.getState().addLog(entry)
}
