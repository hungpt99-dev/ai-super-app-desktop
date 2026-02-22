/**
 * agent-type-store.ts
 *
 * Tracks which downloadable agent types the user has installed from the Hub.
 * Installed types appear alongside built-in templates in the Agents tab.
 */

import { create } from 'zustand'

const INSTALLED_TYPES_KEY = 'agenthub:installed-agent-types'

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

interface IAgentTypesStore {
  /** IDs of downloadable agent types that have been installed from the Hub. */
  installedTypeIds: string[]
  /** Install an agent type by ID. Idempotent. */
  installType(id: string): void
  /** Uninstall an agent type by ID. */
  uninstallType(id: string): void
  /** Returns true if the given type ID is currently installed. */
  isInstalled(id: string): boolean
}

export const useAgentTypesStore = create<IAgentTypesStore>((set, get) => ({
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
