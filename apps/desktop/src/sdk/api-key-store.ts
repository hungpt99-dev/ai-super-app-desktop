/**
 * api-key-store.ts
 *
 * Local BYOK (Bring Your Own Key) storage for the desktop app.
 *
 * Keys are kept in the Tauri secure store (OS keychain-backed) when running
 * inside Tauri. In dev/browser mode they fall back to localStorage.
 *
 * The raw API key is NEVER sent to the cloud backend.
 * Only the local desktop agent reads stored keys when making provider calls.
 */

const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Namespaced localStorage key to avoid collisions. */
const LS_KEY = 'ai-superapp:api-keys'

export interface ILocalAPIKey {
  /** Unique local identifier. */
  id: string
  /** Provider slug — e.g. "openai", "anthropic". */
  provider: string
  /** Human-readable label. */
  label: string
  /**
   * The raw key stored locally.
   * In Tauri production mode this value lives in the OS-encrypted store.
   * In dev mode it lives in localStorage (acceptable for local development only).
   */
  rawKey: string
  isActive: boolean
  createdAt: string
}

// ── Persistence helpers ───────────────────────────────────────────────────────

async function readAll(): Promise<ILocalAPIKey[]> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const raw = await invoke<string | null>('store_get', { key: LS_KEY })
      return raw ? (JSON.parse(raw) as ILocalAPIKey[]) : []
    } catch {
      // Fall through to localStorage when the Tauri command is unavailable
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as ILocalAPIKey[]) : []
  } catch {
    return []
  }
}

async function writeAll(keys: ILocalAPIKey[]): Promise<void> {
  const serialised = JSON.stringify(keys)
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('store_set', { key: LS_KEY, value: serialised })
      return
    } catch {
      // Fall through to localStorage when the Tauri command is unavailable
    }
  }
  localStorage.setItem(LS_KEY, serialised)
}

function generateId(): string {
  return `key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns all stored BYOK entries. */
export async function listAPIKeys(): Promise<ILocalAPIKey[]> {
  return readAll()
}

/**
 * Saves (upserts) a provider key.
 * One key per provider — adding the same provider again replaces the existing entry.
 */
export async function saveAPIKey(
  provider: string,
  rawKey: string,
  label = '',
): Promise<ILocalAPIKey> {
  const keys = await readAll()
  const existing = keys.findIndex((k) => k.provider === provider)
  const existingEntry = existing >= 0 ? keys[existing] : undefined
  const entry: ILocalAPIKey = {
    id: existingEntry?.id ?? generateId(),
    provider,
    label,
    rawKey,
    isActive: true,
    createdAt: existingEntry?.createdAt ?? new Date().toISOString(),
  }
  if (existing >= 0) {
    keys[existing] = entry
  } else {
    keys.push(entry)
  }
  await writeAll(keys)
  return entry
}

/** Removes a stored key by id. */
export async function deleteAPIKey(id: string): Promise<void> {
  const keys = await readAll()
  await writeAll(keys.filter((k) => k.id !== id))
}

/** Enables or disables a stored key. */
export async function setAPIKeyActive(id: string, active: boolean): Promise<ILocalAPIKey | null> {
  const keys = await readAll()
  const idx = keys.findIndex((k) => k.id === id)
  if (idx < 0) return null
  const current = keys[idx]
  if (!current) return null
  const updated: ILocalAPIKey = { ...current, isActive: active }
  keys[idx] = updated
  await writeAll(keys)
  return updated
}

/**
 * Returns the active raw key for a specific provider, or null if none is set.
 * Used by the AI proxy layer when forwarding requests.
 */
export async function getActiveKeyForProvider(provider: string): Promise<string | null> {
  const keys = await readAll()
  const match = keys.find((k) => k.provider === provider && k.isActive)
  return match?.rawKey ?? null
}

// ── Default provider for bot runs ─────────────────────────────────────────────

const DEFAULT_PROVIDER_STORE_KEY = 'ai-superapp:default-provider'

/**
 * Returns the provider slug (e.g. "openai") chosen as the default for local
 * bot runs, or null when none has been set (offline mode).
 */
export async function getDefaultProvider(): Promise<string | null> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const raw = await invoke<string | null>('store_get', { key: DEFAULT_PROVIDER_STORE_KEY })
      return raw ?? null
    } catch { /* fall through */ }
  }
  return localStorage.getItem(DEFAULT_PROVIDER_STORE_KEY)
}

/**
 * Sets (or clears) the default provider for local bot runs.
 * Pass `null` to reset to offline mode.
 */
export async function setDefaultProvider(provider: string | null): Promise<void> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      if (provider !== null) {
        await invoke('store_set', { key: DEFAULT_PROVIDER_STORE_KEY, value: provider })
      } else {
        await invoke('store_del', { key: DEFAULT_PROVIDER_STORE_KEY })
      }
      return
    } catch { /* fall through */ }
  }
  if (provider !== null) {
    localStorage.setItem(DEFAULT_PROVIDER_STORE_KEY, provider)
  } else {
    localStorage.removeItem(DEFAULT_PROVIDER_STORE_KEY)
  }
}
