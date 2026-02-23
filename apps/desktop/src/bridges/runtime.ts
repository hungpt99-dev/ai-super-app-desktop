/**
 * runtime.ts — shared runtime utilities
 *
 * Consolidates:
 *   • IS_TAURI detection
 *   • ID generation (crypto.randomUUID with fallback)
 *   • Safe JSON parsing with schema validation
 *   • Debounced localStorage writes
 *
 * Every file that previously duplicated IS_TAURI or had its own generateId()
 * should import from here instead.
 */

// ── Tauri detection ──────────────────────────────────────────────────────────

/** True when running inside the Tauri WebView runtime. */
export const IS_TAURI: boolean =
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// ── ID generation ────────────────────────────────────────────────────────────

/**
 * Generate a unique local identifier.
 * Uses `crypto.randomUUID()` (available in all modern browsers + Tauri)
 * with a deterministic length fallback.
 */
export function generateId(prefix = 'local'): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`
    }
    // Fallback for older environments — still extremely unlikely to collide.
    const ts = Date.now().toString(36)
    const rand = Math.random().toString(36).slice(2, 10)
    return `${prefix}-${ts}-${rand}`
}

// ── Safe JSON parse ──────────────────────────────────────────────────────────

/**
 * Parse JSON from localStorage (or any string) with error recovery.
 *
 * - Returns `fallback` if `raw` is null/undefined.
 * - Returns `fallback` if parsing fails, and logs the corruption.
 * - Optionally runs a `migrate` function to backfill schema changes.
 */
export function safeJsonParse<T>(
    raw: string | null | undefined,
    fallback: T,
    migrate?: (parsed: unknown) => T,
): T {
    if (raw === null || raw === undefined) return fallback
    try {
        const parsed: unknown = JSON.parse(raw)
        return migrate ? migrate(parsed) : (parsed as T)
    } catch (err) {
        console.warn('[runtime] JSON parse failed, returning fallback:', err)
        return fallback
    }
}

// ── Debounced write ──────────────────────────────────────────────────────────

const _timers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Write a value to localStorage with debouncing.
 * Prevents O(n) serialization on every rapid state change.
 *
 * @param key    localStorage key
 * @param value  the value to serialize and store
 * @param delayMs  debounce delay (default 300ms)
 */
export function debouncedWrite<T>(key: string, value: T, delayMs = 300): void {
    const existing = _timers.get(key)
    if (existing !== undefined) clearTimeout(existing)
    const timer = setTimeout(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value))
        } catch { /* localStorage full — silently degrade */ }
        _timers.delete(key)
    }, delayMs)
    _timers.set(key, timer)
}

/**
 * Immediately write to localStorage (no debounce).
 * Use for critical writes that must not be lost (e.g. agent creation).
 */
export function immediateWrite<T>(key: string, value: T): void {
    // Cancel any pending debounced write for the same key.
    const existing = _timers.get(key)
    if (existing !== undefined) {
        clearTimeout(existing)
        _timers.delete(key)
    }
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch { /* ignore */ }
}

// ── Agent schema migration ───────────────────────────────────────────────────

/**
 * Current schema version for persisted agent data.
 * Bump this when the IDesktopAgent shape changes.
 */
export const AGENT_SCHEMA_VERSION = 2

/**
 * Migrate a raw agent record to the current schema.
 * Handles backward compatibility when new fields are added.
 */
export function migrateAgent(raw: Record<string, unknown>): Record<string, unknown> {
    const version = (typeof raw._schemaVersion === 'number') ? raw._schemaVersion : 1

    // v1 → v2: add `config` object, `disabledTools` array
    if (version < 2) {
        if (!raw.config || typeof raw.config !== 'object') {
            raw.config = {}
        }
        if (!Array.isArray(raw.disabledTools)) {
            raw.disabledTools = undefined
        }
        raw._schemaVersion = 2
    }

    return raw
}

/**
 * Migrate an array of raw agent records and return typed agents.
 * This is the `migrate` callback for safeJsonParse.
 */
export function migrateAgents<T>(parsed: unknown): T {
    if (!Array.isArray(parsed)) return [] as unknown as T
    return parsed.map((item) => {
        if (typeof item === 'object' && item !== null) {
            return migrateAgent(item as Record<string, unknown>)
        }
        return item
    }) as unknown as T
}

// ── Chat history limits ──────────────────────────────────────────────────────

/** Maximum messages retained per agent conversation. */
export const MAX_CHAT_MESSAGES_PER_AGENT = 500

/**
 * Truncate a chat history record so no agent exceeds MAX_CHAT_MESSAGES_PER_AGENT.
 * Keeps the most recent messages.
 */
export function truncateChatHistory<T>(
    history: Record<string, T[]>,
): Record<string, T[]> {
    const result: Record<string, T[]> = {}
    for (const [key, msgs] of Object.entries(history)) {
        result[key] = msgs.length > MAX_CHAT_MESSAGES_PER_AGENT
            ? msgs.slice(-MAX_CHAT_MESSAGES_PER_AGENT)
            : msgs
    }
    return result
}
