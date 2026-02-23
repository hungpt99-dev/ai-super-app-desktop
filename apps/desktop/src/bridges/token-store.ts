import { GatewayClient } from './gateway-client.js'

/** True when running inside the Tauri WebView runtime. */
import { IS_TAURI } from './runtime.js'

/**
 * ITokenStore — Strategy Pattern.
 * Allows swapping token sources: in-memory dev ↔ Tauri-plugin-store (prod).
 */
export interface ITokenStore {
  /** Returns the current access token, or an empty string when not set. */
  getToken(): string
  /** Persists a new token. */
  setToken(token: string): void
  /** Removes the stored token. */
  clearToken(): void
  hasToken(): boolean
}

/**
 * TauriTokenStore — used when running inside the Tauri WebView.
 *
 * The token actually lives in the Rust backend (tauri-plugin-store, OS-backed
 * encryption). Rust commands load it on demand; the TypeScript layer only
 * keeps a local in-memory cache so synchronous reads remain fast.
 *
 * Initialise the cache at startup by calling `initTauriTokenCache()` once
 * (done inside module-bootstrap.ts).
 */
class TauriTokenStore implements ITokenStore {
  private cached: string | null = null

  /** Pre-warm the cache from the Rust store. Call once at app startup. */
  async init(): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const token = await invoke<string | null>('get_token')
      this.cached = token ?? null
    } catch {
      this.cached = null
    }
  }

  getToken(): string {
    return this.cached ?? ''
  }

  setToken(token: string): void {
    this.cached = token
    void import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke('set_token', { token }),
    )
  }

  clearToken(): void {
    this.cached = null
    void import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke('clear_token'),
    )
  }

  hasToken(): boolean {
    return Boolean(this.cached)
  }
}

/**
 * DevTokenStore — used when running in a plain browser (npm run dev:renderer).
 *
 * Reads from the `VITE_DEV_TOKEN` env var as the initial token so devs can
 * supply a real JWT without going through the login flow.
 */
class DevTokenStore implements ITokenStore {
  private cached: string | null = null

  getToken(): string {
    return this.cached ?? import.meta.env.VITE_DEV_TOKEN ?? ''
  }

  setToken(token: string): void {
    this.cached = token
  }

  clearToken(): void {
    this.cached = null
  }

  hasToken(): boolean {
    return Boolean(this.cached ?? import.meta.env.VITE_DEV_TOKEN)
  }
}

/** Singleton token store shared by GatewayClient and the dev bridge. */
export const tokenStore: ITokenStore = IS_TAURI ? new TauriTokenStore() : new DevTokenStore()

/**
 * Warm the Tauri token cache from the Rust store.
 * Must be awaited once at startup before any `tokenStore.getToken()` calls.
 * No-op in browser dev mode.
 */
export async function initTokenStore(): Promise<void> {
  if (IS_TAURI) {
    await (tokenStore as TauriTokenStore).init()
  }
}

/**
 * gatewayClient — singleton GatewayClient for all backend HTTP calls in dev mode.
 *
 * In Tauri mode this is only used by the AiSdkProxy dev fallback path.
 * In browser dev mode it is the sole HTTP transport.
 */
export const gatewayClient: GatewayClient = new GatewayClient({
  baseURL: import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000',
  getToken: () => tokenStore.getToken(),
})
