/**
 * Key management — API key and signing key lifecycle.
 *
 * See: docs/technical-design.md §10.2 Secret Vault
 */

// ─── Key Manager Interface ──────────────────────────────────────────────────

export interface IKeyManager {
    /** Store a key under the given name. */
    store(name: string, key: string): Promise<void>
    /** Retrieve a key by name. Returns null if not found. */
    retrieve(name: string): Promise<string | null>
    /** Delete a key by name. */
    delete(name: string): Promise<void>
    /** List all stored key names (values NOT returned). */
    list(): Promise<string[]>
    /** Rotate a key — store new value and return the old one. */
    rotate(name: string, newKey: string): Promise<string | null>
}
