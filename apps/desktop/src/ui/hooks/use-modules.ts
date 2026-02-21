import { useEffect } from 'react'
import { useModuleStore } from '../store/module-store.js'

export type { IModuleInfo } from '../store/module-store.js'

/**
 * useModules — thin wrapper over useModuleStore.
 * Triggers the initial fetch on first mount.
 */
export function useModules() {
  const store = useModuleStore()

  useEffect(() => {
    // refresh() is a stable Zustand action, no need to include in deps
    void store.refresh()
  }, [])

  return store
}
