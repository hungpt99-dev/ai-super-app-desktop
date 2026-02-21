/**
 * marketplace-store.ts
 * State for the Bot Marketplace — listing, install and uninstall management.
 */

import { create } from 'zustand'
import { marketplaceApi, type IMarketplaceBot } from '../lib/api-client.js'

interface IMarketplaceStore {
  bots: IMarketplaceBot[]
  installedBots: IMarketplaceBot[]
  loading: boolean
  error: string | null
  searchQuery: string
  selectedCategory: string

  fetchBots: (query?: string, category?: string) => Promise<void>
  fetchInstalled: () => Promise<void>
  install: (botId: string) => Promise<void>
  uninstall: (botId: string) => Promise<void>
  setSearch: (q: string) => void
  setCategory: (c: string) => void
  clearError: () => void
}

export const useMarketplaceStore = create<IMarketplaceStore>((set, get) => ({
  bots: [],
  installedBots: [],
  loading: false,
  error: null,
  searchQuery: '',
  selectedCategory: 'all',

  fetchBots: async (query, category) => {
    const q = query ?? get().searchQuery
    const cat = category ?? get().selectedCategory
    set({ loading: true, error: null })
    try {
      const bots = await marketplaceApi.list(q, cat)
      set({ bots, loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  fetchInstalled: async () => {
    try {
      const installedBots = await marketplaceApi.getInstalled()
      set({ installedBots })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  install: async (botId) => {
    await marketplaceApi.install(botId)
    set((s) => ({
      bots: s.bots.map((b) => (b.id === botId ? { ...b, installed: true } : b)),
    }))
    await get().fetchInstalled()
  },

  uninstall: async (botId) => {
    await marketplaceApi.uninstall(botId)
    set((s) => ({
      bots: s.bots.map((b) => (b.id === botId ? { ...b, installed: false } : b)),
      installedBots: s.installedBots.filter((b) => b.id !== botId),
    }))
  },

  setSearch: (q) => { set({ searchQuery: q }) },
  setCategory: (c) => { set({ selectedCategory: c }) },
  clearError: () => { set({ error: null }) },
}))

