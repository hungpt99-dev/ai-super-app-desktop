import { create } from 'zustand'
import {
  authLogin,
  authRegister,
  authMe,
  authLogout,
  authRefresh,
} from '../../bridges/auth-api.js'
import { tokenStore } from '../../bridges/token-store.js'
import { logger } from '@agenthub/shared'
import { useAppStore } from './app-store.js'
import { IS_TAURI } from '../../bridges/runtime.js'

function notifyError(title: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  useAppStore.getState().pushNotification({ level: 'error', title, body: msg })
}

// NOTE: device registration is handled by startAgentLoop() (called on auth events)
// to avoid duplicating platform detection and request logic.

const log = logger.child('AuthStore')

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_TOKEN_KEY = 'agenthub-refresh-token'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Save refresh token to Tauri secure store (OS keychain) when available,
 * falls back to localStorage only in browser dev mode.
 */
async function saveRefreshToken(token: string): Promise<void> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('set_token', { token: `refresh:${token}` })
      // Also remove from localStorage if it was there from a previous version
      try { localStorage.removeItem(REFRESH_TOKEN_KEY) } catch { /* ignore */ }
      return
    } catch { /* fall through to localStorage in dev */ }
  }
  try { localStorage.setItem(REFRESH_TOKEN_KEY, token) } catch { /* ignore */ }
}

async function loadRefreshToken(): Promise<string | null> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const raw = await invoke<string | null>('get_token', {})
      if (raw !== null && raw.startsWith('refresh:')) {
        return raw.slice('refresh:'.length)
      }
    } catch { /* fall through */ }
  }
  try { return localStorage.getItem(REFRESH_TOKEN_KEY) } catch { return null }
}

async function clearRefreshToken(): Promise<void> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('clear_token', {})
    } catch { /* fall through */ }
  }
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
   * Open an OAuth popup window (Google or GitHub) and, on success, store the
   * returned tokens and load the user profile.
   */
  loginWithOAuth: (provider: 'google' | 'github') => void

  /**
   * Process OAuth tokens received via the /oauth/callback redirect.
   * Called from the OAuth popup window before it closes itself.
   */
  handleOAuthCallback: (accessToken: string, refreshToken: string) => Promise<void>

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

export const useAuthStore = create<IAuthState>((set, get) => ({
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
      await saveRefreshToken(tokens.refresh_token)
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
      // Device registration is handled by startAgentLoop() triggered by the auth state change.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Check your credentials.'
      notifyError('Sign-in failed', err)
      set({ isLoading: false, error: message })
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true, error: null })
    try {
      const tokens = await authRegister(email, password, name)
      tokenStore.setToken(tokens.access_token)
      await saveRefreshToken(tokens.refresh_token)
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
      // Device registration is handled by startAgentLoop() triggered by the auth state change.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Try again.'
      notifyError('Registration failed', err)
      set({ isLoading: false, error: message })
    }
  },

  loginWithOAuth: (provider) => {
    set({ isLoading: true, error: null })
    void (async () => {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
        const { listen } = await import('@tauri-apps/api/event')

        const base = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000'
        const redirectUri = encodeURIComponent(`${window.location.origin}/oauth/callback`)
        const oauthUrl = `${base}/v1/auth/oauth/${provider}?redirect_uri=${redirectUri}`

        const popup = new WebviewWindow('oauth-popup', {
          url: oauthUrl,
          title: `Sign in with ${provider === 'google' ? 'Google' : 'GitHub'}`,
          width: 480,
          height: 660,
          center: true,
        })

        const unlisten = await listen<{ access_token: string; refresh_token: string }>(
          'oauth-callback',
          (event) => {
            void (async () => {
              unlisten()
              set({ isLoading: false })
              try { await popup.close() } catch { /* already closed by the popup itself */ }
              await get().handleOAuthCallback(
                event.payload.access_token,
                event.payload.refresh_token,
              )
            })()
          },
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open OAuth window.'
        notifyError('OAuth sign-in failed', err)
        set({ isLoading: false, error: message })
      }
    })()
  },

  handleOAuthCallback: async (accessToken, refreshToken) => {
    set({ isLoading: true, error: null })
    tokenStore.setToken(accessToken)
    await saveRefreshToken(refreshToken)
    try {
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
      log.info('OAuth sign-in complete', { userId: profile.id })
      // Device registration is handled by startAgentLoop() triggered by the auth state change.
    } catch (err) {
      tokenStore.clearToken()
      await clearRefreshToken()
      const message = err instanceof Error ? err.message : 'OAuth authentication failed.'
      notifyError('OAuth authentication failed', err)
      set({ isAuthenticated: false, isLoading: false, error: message })
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      const refreshToken = await loadRefreshToken()
      if (refreshToken) {
        await authLogout(refreshToken)
      }
    } catch (err) {
      // Never block logout on a server error
      log.warn('Server logout failed (proceeding with local clear)', { err })
    } finally {
      tokenStore.clearToken()
      await clearRefreshToken()
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
        // Device registration is handled by startAgentLoop() triggered by the auth state change.
        return
      }

      // Fall back to refresh token rotation
      const refreshToken = await loadRefreshToken()
      if (refreshToken) {
        const tokens = await authRefresh(refreshToken)
        tokenStore.setToken(tokens.access_token)
        await saveRefreshToken(tokens.refresh_token)
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
        // Device registration is handled by startAgentLoop() triggered by the auth state change.
        return
      }
    } catch (err) {
      // Expired / revoked token — clear everything silently
      log.info('Session restore failed, user must sign in', { err })
      tokenStore.clearToken()
      await clearRefreshToken()
    }

    set({ isAuthenticated: false, isCheckingAuth: false })
  },

  clearError: () => { set({ error: null }) },
}))
