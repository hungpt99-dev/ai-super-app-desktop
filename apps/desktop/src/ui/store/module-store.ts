import { create } from 'zustand'
import { getDesktopBridge } from '../lib/bridge.js'

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
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load modules',
      })
    }
  },

  uninstall: async (moduleId: string) => {
    try {
      const bridge = getDesktopBridge()
      await bridge.modules.uninstall(moduleId)
      await get().refresh()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to uninstall module' })
    }
  },
}))
