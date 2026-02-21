import { create } from 'zustand'
import {
  authLogin,
  authRegister,
  authMe,
  authLogout,
  authRefresh,
} from '../../sdk/auth-api.js'
import { tokenStore } from '../../sdk/token-store.js'
import { logger } from '@ai-super-app/shared'

const log = logger.child('AuthStore')

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_TOKEN_KEY = 'ai-superapp-refresh-token'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saveRefreshToken(token: string): void {
  try { localStorage.setItem(REFRESH_TOKEN_KEY, token) } catch { /* ignore */ }
}

function loadRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_TOKEN_KEY) } catch { return null }
}

function clearRefreshToken(): void {
  try { localStorage.removeItem(REFRESH_TOKEN_KEY) } catch { /* ignore */ }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IUser {
  id: string
  email: string
  name: string
  plan: 'free' | 'pro' | 'enterprise'
  created_at?: string
}

interface IAuthState {
  isAuthenticated: boolean
  isLoading: boolean
  /** True during the silent startup token check — hides the app until resolved. */
  isCheckingAuth: boolean
  user: IUser | null
  error: string | null

  /**
   * Sign in with email + password.
   * On success, stores the JWT + refresh token and loads the user profile.
   */
  login(email: string, password: string): Promise<void>

  /**
   * Create an account and sign in immediately.
   */
  register(email: string, password: string, name: string): Promise<void>

  /**
   * Sign out: revoke the server-side refresh token and clear all local tokens.
   */
  logout(): Promise<void>

  /**
   * Called once at startup — silently restores the session if a valid token
   * exists. Sets `isCheckingAuth = false` when done regardless of outcome.
   */
  checkAuth(): Promise<void>

  /** Clear any displayed error message. */
  clearError(): void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<IAuthState>((set) => ({
  isAuthenticated: false,
  isLoading: false,
  isCheckingAuth: true,
  user: null,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const tokens = await authLogin(email, password)
      tokenStore.setToken(tokens.access_token)
      saveRefreshToken(tokens.refresh_token)
      const profile = await authMe()
      set({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          plan: profile.plan,
          created_at: profile.created_at,
        },
      })
      log.info('User signed in', { userId: profile.id })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Check your credentials.'
      set({ isLoading: false, error: message })
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true, error: null })
    try {
      const tokens = await authRegister(email, password, name)
      tokenStore.setToken(tokens.access_token)
      saveRefreshToken(tokens.refresh_token)
      const profile = await authMe()
      set({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          plan: profile.plan,
          created_at: profile.created_at,
        },
      })
      log.info('User registered', { userId: profile.id })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Try again.'
      set({ isLoading: false, error: message })
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      const refreshToken = loadRefreshToken()
      if (refreshToken) {
        await authLogout(refreshToken)
      }
    } catch (err) {
      // Never block logout on a server error
      log.warn('Server logout failed (proceeding with local clear)', { err })
    } finally {
      tokenStore.clearToken()
      clearRefreshToken()
      set({ isAuthenticated: false, isLoading: false, user: null, error: null })
    }
  },

  checkAuth: async () => {
    set({ isCheckingAuth: true })
    try {
      // First try the existing access token
      if (tokenStore.hasToken()) {
        const profile = await authMe()
        set({
          isAuthenticated: true,
          isCheckingAuth: false,
          user: {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            plan: profile.plan,
            created_at: profile.created_at,
          },
        })
        return
      }

      // Fall back to refresh token rotation
      const refreshToken = loadRefreshToken()
      if (refreshToken) {
        const tokens = await authRefresh(refreshToken)
        tokenStore.setToken(tokens.access_token)
        saveRefreshToken(tokens.refresh_token)
        const profile = await authMe()
        set({
          isAuthenticated: true,
          isCheckingAuth: false,
          user: {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            plan: profile.plan,
            created_at: profile.created_at,
          },
        })
        return
      }
    } catch (err) {
      // Expired / revoked token — clear everything silently
      log.info('Session restore failed, user must sign in', { err })
      tokenStore.clearToken()
      clearRefreshToken()
    }

    set({ isAuthenticated: false, isCheckingAuth: false })
  },

  clearError: () => { set({ error: null }) },
}))
