/**
 * marketplace-store.ts
 * State for the Mini-App marketplace — app listing + install management.
 */

import { create } from 'zustand'
import { marketplaceApi, type IMiniApp } from '../lib/api-client.js'

interface IMarketplaceStore {
  apps: IMiniApp[]
  installedApps: IMiniApp[]
  loading: boolean
  error: string | null
  searchQuery: string
  selectedCategory: string

  fetchApps(query?: string, category?: string): Promise<void>
  fetchInstalled(): Promise<void>
  install(appId: string): Promise<void>
  uninstall(appId: string): Promise<void>
  setSearch(q: string): void
  setCategory(c: string): void
  clearError(): void
}

export const useMarketplaceStore = create<IMarketplaceStore>((set, get) => ({
  apps: [],
  installedApps: [],
  loading: false,
  error: null,
  searchQuery: '',
  selectedCategory: 'all',

  fetchApps: async (query, category) => {
    const q = query ?? get().searchQuery
    const cat = category ?? get().selectedCategory
    set({ loading: true, error: null })
    try {
      const apps = await marketplaceApi.list(q, cat)
      set({ apps, loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  fetchInstalled: async () => {
    try {
      const installedApps = await marketplaceApi.getInstalled()
      set({ installedApps })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  install: async (appId) => {
    await marketplaceApi.install(appId)
    // Mark as installed in both lists.
    set((s) => ({
      apps: s.apps.map((a) => (a.id === appId ? { ...a, installed: true } : a)),
    }))
    await get().fetchInstalled()
  },

  uninstall: async (appId) => {
    await marketplaceApi.uninstall(appId)
    set((s) => ({
      apps: s.apps.map((a) => (a.id === appId ? { ...a, installed: false } : a)),
      installedApps: s.installedApps.filter((a) => a.id !== appId),
    }))
  },

  setSearch: (q) => set({ searchQuery: q }),
  setCategory: (c) => set({ selectedCategory: c }),
  clearError: () => set({ error: null }),
}))
