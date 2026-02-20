/**
 * auth-store.ts
 * Global authentication state — user profile, login, logout.
 */

import { create } from 'zustand'
import {
  loginWithEmail,
  register as registerFn,
  authApi,
  clearSession,
  getRefreshToken,
  type IUser,
} from '../lib/api-client.js'

interface IAuthStore {
  user: IUser | null
  loading: boolean
  error: string | null

  fetchMe(): Promise<void>
  login(email: string, password: string): Promise<void>
  register(email: string, name: string, password: string): Promise<void>
  logout(): Promise<void>
  logoutAll(): Promise<void>
  changePassword(current: string, next: string): Promise<void>
  deleteAccount(): Promise<void>
  clearError(): void
}

export const useAuthStore = create<IAuthStore>((set) => ({
  user: null,
  loading: false,
  error: null,

  fetchMe: async () => {
    try {
      const user = await authApi.me()
      set({ user })
    } catch {
      // silently ignore — user may not be authenticated yet
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const data = await loginWithEmail(email, password)
      set({ user: data.user, loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
      throw e
    }
  },

  register: async (email, name, password) => {
    set({ loading: true, error: null })
    try {
      const data = await registerFn(email, name, password)
      set({ user: data.user, loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
      throw e
    }
  },

  logout: async () => {
    const rt = getRefreshToken()
    if (rt) {
      try { await authApi.logout(rt) } catch { /* best effort */ }
    }
    clearSession()
    set({ user: null })
  },

  logoutAll: async () => {
    try { await authApi.logoutAll() } catch { /* best effort */ }
    clearSession()
    set({ user: null })
  },

  changePassword: async (current, next) => {
    set({ loading: true, error: null })
    try {
      await authApi.changePassword(current, next)
      set({ loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
      throw e
    }
  },

  deleteAccount: async () => {
    set({ loading: true, error: null })
    try {
      await authApi.deleteAccount()
      clearSession()
      set({ user: null, loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
      throw e
    }
  },

  clearError: () => set({ error: null }),
}))
