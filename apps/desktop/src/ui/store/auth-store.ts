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

// ─── Device auto-registration ─────────────────────────────────────────────────

function detectPlatform(): string {
  const ua = navigator.userAgent
  if (ua.includes('Mac OS')) return 'macOS'
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Linux')) return 'Linux'
  return 'Desktop'
}

/**
 * Fire-and-forget: registers this machine as a device on the backend.
 * Called after every successful auth event (login, register, token restore).
 * Errors are logged but never propagated — this must never block the auth flow.
 */
async function registerThisDevice(): Promise<void> {
  const token = tokenStore.getToken()
  if (!token) return

  const base = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000'
  const platform = detectPlatform()
  const name = `${platform} Desktop`
  const version = import.meta.env.VITE_APP_VERSION ?? '1.0.0'

  try {
    await fetch(`${base}/v1/devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, platform, version }),
    })
  } catch (err) {
    log.warn('Device auto-registration failed (non-fatal)', { err })
  }
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
      void registerThisDevice()
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
      void registerThisDevice()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Try again.'
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
        set({ isLoading: false, error: message })
      }
    })()
  },

  handleOAuthCallback: async (accessToken, refreshToken) => {
    set({ isLoading: true, error: null })
    tokenStore.setToken(accessToken)
    saveRefreshToken(refreshToken)
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
      void registerThisDevice()
    } catch (err) {
      tokenStore.clearToken()
      clearRefreshToken()
      const message = err instanceof Error ? err.message : 'OAuth authentication failed.'
      set({ isAuthenticated: false, isLoading: false, error: message })
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
        void registerThisDevice()
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
        void registerThisDevice()
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
