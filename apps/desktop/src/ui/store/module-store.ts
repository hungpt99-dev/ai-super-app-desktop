import { create } from 'zustand'
import { getDesktopBridge } from '../lib/bridge.js'
import { useAppStore } from './app-store.js'

function notifyError(title: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  useAppStore.getState().pushNotification({ level: 'error', title, body: msg })
}

export interface IModuleInfo {
  id: string
  name: string
  version: string
}

export interface IModuleState {
  modules: IModuleInfo[]
  isLoading: boolean
  error: string | null
  refresh(): Promise<void>
  uninstall(moduleId: string): Promise<void>
}

/**
 * useModuleStore — Zustand store for the installed module list.
 * Shared across FeatureGrid, ModuleStore, and any hook that needs it.
 */
export const useModuleStore = create<IModuleState>((set, get) => ({
  modules: [],
  isLoading: false,
  error: null,

  refresh: async () => {
    set({ isLoading: true, error: null })
    try {
      const bridge = getDesktopBridge()
      const list = await bridge.modules.list()
      set({ modules: list, isLoading: false })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load modules'
      notifyError('Failed to load modules', err)
      set({ isLoading: false, error: msg })
    }
  },

  uninstall: async (moduleId: string) => {
    try {
      const bridge = getDesktopBridge()
      await bridge.modules.uninstall(moduleId)
      await get().refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to uninstall module'
      notifyError('Failed to uninstall module', err)
      set({ error: msg })
    }
  },
}))
