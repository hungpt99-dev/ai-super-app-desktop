/**
 * api-key-store.ts
 *
 * Local BYOK (Bring Your Own Key) storage for the desktop app.
 *
 * Keys are kept in the Tauri secure store (OS keychain-backed) when running
 * inside Tauri. In dev/browser mode they fall back to encrypted localStorage.
 *
 * SECURITY: Encryption key is kept IN-MEMORY ONLY in browser mode.
 * This prevents XSS attacks from stealing API keys.
 * Trade-off: Users need to re-enter keys after page refresh in browser dev mode.
 *
 * The raw API key is NEVER sent to the cloud backend.
 * Only the local desktop agent reads stored keys when making provider calls.
 */

import { IS_TAURI } from './runtime.js'

/** Namespaced localStorage key to avoid collisions. */
const LS_KEY = 'agenthub:api-keys'

// Encryption key for dev mode - IN-MEMORY ONLY for security
// Generated fresh on each page load - must re-enter keys after refresh in browser
let encryptionKey: CryptoKey | null = null

/**
 * Initialize encryption key for dev mode.
 * SECURITY: Key is generated fresh each session - never persisted.
 */
async function initEncryption(): Promise<void> {
  if (encryptionKey) return

  // SECURITY: Generate a fresh key each session - never read from storage
  // This prevents XSS attacks from stealing the encryption key
  encryptionKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  // Key is kept in memory only - not persisted
}

/**
 * Encrypt data for localStorage storage.
 */
async function encryptForStorage(data: string): Promise<string> {
  await initEncryption()
  if (!encryptionKey) throw new Error('Encryption not initialized')

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    encoder.encode(data)
  )

  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)

  // Convert Uint8Array to base64 string using browser APIs
  let binary = ''
  const bytes = new Uint8Array(combined)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Decrypt data from localStorage.
 */
async function decryptFromStorage(encryptedData: string): Promise<string> {
  await initEncryption()
  if (!encryptionKey) throw new Error('Encryption not initialized')

  // Convert base64 string to Uint8Array using browser APIs
  const binary = atob(encryptedData)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const iv = bytes.slice(0, 12)
  const ciphertext = bytes.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    ciphertext
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

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
   * In dev mode it lives in localStorage with AES-256-GCM encryption.
   */
  rawKey: string
  /** Model identifier to use with this key, e.g. "gpt-4o". Uses provider default when omitted. */
  model?: string
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
      // Fall through to encrypted localStorage when the Tauri command is unavailable
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    // Decrypt the data from localStorage
    const decrypted = await decryptFromStorage(raw)
    return JSON.parse(decrypted) as ILocalAPIKey[]
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
      // Fall through to encrypted localStorage when the Tauri command is unavailable
    }
  }
  // Encrypt before storing in localStorage
  const encrypted = await encryptForStorage(serialised)
  localStorage.setItem(LS_KEY, encrypted)
}

function generateId(): string {
  return `key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Input Validation ────────────────────────────────────────────────────────────

/**
 * Validates input parameters to prevent injection attacks.
 */
function validateProvider(provider: string): void {
  if (!provider || typeof provider !== 'string') {
    throw new Error('Provider is required')
  }
  if (provider.length > 50) {
    throw new Error('Provider name too long')
  }
  // Only allow alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(provider)) {
    throw new Error('Provider contains invalid characters')
  }
}

function validateLabel(label: string): void {
  if (label && typeof label !== 'string') {
    throw new Error('Label must be a string')
  }
  if (label && label.length > 100) {
    throw new Error('Label too long (max 100 characters)')
  }
}

function validateModel(model: string): void {
  if (model && typeof model !== 'string') {
    throw new Error('Model must be a string')
  }
  if (model && model.length > 100) {
    throw new Error('Model name too long (max 100 characters)')
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns all stored BYOK entries. */
export async function listAPIKeys(): Promise<ILocalAPIKey[]> {
  return readAll()
}

/**
 * Saves a new provider key.
 * Multiple keys per provider are allowed — each gets a unique id.
 */
export async function saveAPIKey(
  provider: string,
  rawKey: string,
  label = '',
  model?: string,
): Promise<ILocalAPIKey> {
  // Validate inputs
  validateProvider(provider)
  validateLabel(label)
  if (model) validateModel(model)
  
  if (!rawKey || typeof rawKey !== 'string' || rawKey.trim().length === 0) {
    throw new Error('API key is required and cannot be empty')
  }
  
  const keys = await readAll()
  const entry: ILocalAPIKey = {
    id: generateId(),
    provider,
    label,
    rawKey,
    ...(model ? { model } : {}),
    isActive: true,
    createdAt: new Date().toISOString(),
  }
  keys.push(entry)
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

/** Updates the label and/or model of a stored key. */
export async function updateAPIKey(
  id: string,
  updates: Partial<Pick<ILocalAPIKey, 'label' | 'model'>>,
): Promise<ILocalAPIKey | null> {
  // Validate inputs
  if (updates.label !== undefined) validateLabel(updates.label)
  if (updates.model !== undefined) validateModel(updates.model)
  
  const keys = await readAll()
  const idx = keys.findIndex((k) => k.id === id)
  if (idx < 0) return null
  const current = keys[idx]
  if (!current) return null
  const updated: ILocalAPIKey = { ...current, ...updates }
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

// ── Default key for agent runs ─────────────────────────────────────────────────────────

const DEFAULT_KEY_STORE_KEY = 'agenthub:default-key'

/**
 * Returns the key ID chosen as the default for local agent runs,
 * or null when none has been set (offline mode).
 */
export async function getDefaultKeyId(): Promise<string | null> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const raw = await invoke<string | null>('store_get', { key: DEFAULT_KEY_STORE_KEY })
      return raw ?? null
    } catch { /* fall through */ }
  }
  return localStorage.getItem(DEFAULT_KEY_STORE_KEY)
}

/**
 * Sets (or clears) the default key ID for local agent runs.
 * Pass `null` to reset to offline mode.
 */
export async function setDefaultKeyId(keyId: string | null): Promise<void> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      if (keyId !== null) {
        await invoke('store_set', { key: DEFAULT_KEY_STORE_KEY, value: keyId })
      } else {
        await invoke('store_del', { key: DEFAULT_KEY_STORE_KEY })
      }
      return
    } catch { /* fall through */ }
  }
  if (keyId !== null) {
    localStorage.setItem(DEFAULT_KEY_STORE_KEY, keyId)
  } else {
    localStorage.removeItem(DEFAULT_KEY_STORE_KEY)
  }
}
