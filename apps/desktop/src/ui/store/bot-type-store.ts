/**
 * bot-type-store.ts
 *
 * Tracks which downloadable bot types the user has installed from the Store.
 * Installed types appear alongside built-in templates in the Bots tab.
 */

import { create } from 'zustand'

const INSTALLED_TYPES_KEY = 'ai-superapp:installed-bot-types'

function readInstalled(): string[] {
  try {
    return JSON.parse(localStorage.getItem(INSTALLED_TYPES_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function writeInstalled(ids: string[]): void {
  try { localStorage.setItem(INSTALLED_TYPES_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
}

interface IBotTypeStore {
  /** IDs of downloadable bot types that have been installed from the Store. */
  installedTypeIds: string[]
  /** Install a bot type by ID. Idempotent. */
  installType(id: string): void
  /** Uninstall a bot type by ID. */
  uninstallType(id: string): void
  /** Returns true if the given type ID is currently installed. */
  isInstalled(id: string): boolean
}

export const useBotTypeStore = create<IBotTypeStore>((set, get) => ({
  installedTypeIds: readInstalled(),

  installType: (id) => {
    const updated = [...new Set([...get().installedTypeIds, id])]
    writeInstalled(updated)
    set({ installedTypeIds: updated })
  },

  uninstallType: (id) => {
    const updated = get().installedTypeIds.filter((x) => x !== id)
    writeInstalled(updated)
    set({ installedTypeIds: updated })
  },

  isInstalled: (id) => get().installedTypeIds.includes(id),
}))
