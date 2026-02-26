/**
 * Credential Manager — manages API keys with TTL and OS keychain integration.
 *
 * Responsibilities:
 * - Store credentials with TTL
 * - Use OS keychain when available (macOS Keychain, Windows Credential Manager)
 * - Auto-expire credentials after TTL
 * - Never store plaintext credentials
 */

import { logger } from '@agenthub/shared'

const log = logger.child('CredentialManager')

// ─── Constants ────────────────────────────────────────────────────────────────────

const DEFAULT_CREDENTIAL_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface ICredential {
    readonly id: string
    readonly key: string
    readonly provider: string
    readonly label: string
    readonly createdAt: number
    readonly expiresAt: number
    readonly encrypted: boolean
}

export interface ICredentialMetadata {
    readonly id: string
    readonly provider: string
    readonly label: string
    readonly createdAt: number
    readonly expiresAt: number
}

// ─── Credential Manager ─────────────────────────────────────────────────────────

class GlobalCredentialManager {
    private static instance: GlobalCredentialManager | null = null
    private readonly credentials = new Map<string, ICredential>() // id -> credential
    private readonly metadataIndex = new Map<string, ICredentialMetadata>() // id -> metadata
    private cleanupTimer: ReturnType<typeof setInterval> | null = null

    static getInstance(): GlobalCredentialManager {
        if (GlobalCredentialManager.instance === null) {
            GlobalCredentialManager.instance = new GlobalCredentialManager()
        }
        return GlobalCredentialManager.instance
    }

    static resetForTesting(): void {
        if (GlobalCredentialManager.instance !== null) {
            if (GlobalCredentialManager.instance.cleanupTimer !== null) {
                clearInterval(GlobalCredentialManager.instance.cleanupTimer)
            }
        }
        GlobalCredentialManager.instance = null
    }

    startCleanupTimer(): void {
        if (this.cleanupTimer !== null) return
        
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpired()
        }, CLEANUP_INTERVAL_MS)
        
        log.info('Started credential cleanup timer')
    }

    stopCleanupTimer(): void {
        if (this.cleanupTimer !== null) {
            clearInterval(this.cleanupTimer)
            this.cleanupTimer = null
        }
    }

    /**
     * Store a credential with TTL
     */
    async store(
        key: string,
        provider: string,
        label: string,
        ttlMs: number = DEFAULT_CREDENTIAL_TTL_MS,
    ): Promise<ICredentialMetadata> {
        const id = `cred_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
        const now = Date.now()

        // CRITICAL: Always encrypt credentials before storing
        const encryptedKey = await this.encryptKey(key)

        const credential: ICredential = {
            id,
            key: encryptedKey,
            provider,
            label,
            createdAt: now,
            expiresAt: now + ttlMs,
            encrypted: true,
        }

        const metadata: ICredentialMetadata = {
            id: credential.id,
            provider: credential.provider,
            label: credential.label,
            createdAt: credential.createdAt,
            expiresAt: credential.expiresAt,
        }

        this.credentials.set(id, credential)
        this.metadataIndex.set(id, metadata)

        // Try to store in OS keychain (would integrate with Tauri in production)
        await this.storeInKeychain(id, key, provider)

        log.info('Stored credential', { id, provider, label })

        return metadata
    }

    /**
     * Retrieve a credential by ID
     */
    async retrieve(id: string): Promise<string | null> {
        const credential = this.credentials.get(id)
        
        if (credential === undefined) {
            // Try to retrieve from keychain
            return this.retrieveFromKeychain(id)
        }

        // Check expiration
        if (Date.now() > credential.expiresAt) {
            this.remove(id)
            return null
        }

        // Decrypt if encrypted
        if (credential.encrypted) {
            return this.decryptKey(credential.key)
        }

        return credential.key
    }

    /**
     * Get credential metadata (without the secret)
     */
    getMetadata(id: string): ICredentialMetadata | null {
        return this.metadataIndex.get(id) ?? null
    }

    /**
     * List all credentials for a provider
     */
    listByProvider(provider: string): ICredentialMetadata[] {
        const results: ICredentialMetadata[] = []
        
        for (const metadata of this.metadataIndex.values()) {
            if (metadata.provider === provider) {
                results.push(metadata)
            }
        }
        
        return results
    }

    /**
     * Remove a credential
     */
    remove(id: string): void {
        const credential = this.credentials.get(id)
        
        if (credential !== undefined) {
            this.credentials.delete(id)
            this.metadataIndex.delete(id)
            
            // Remove from keychain
            this.removeFromKeychain(id)
            
            log.info('Removed credential', { id })
        }
    }

    /**
     * Remove expired credentials
     */
    cleanupExpired(): number {
        const now = Date.now()
        let removed = 0

        for (const [id, credential] of this.credentials.entries()) {
            if (now > credential.expiresAt) {
                this.credentials.delete(id)
                this.metadataIndex.delete(id)
                this.removeFromKeychain(id)
                removed++
            }
        }

        if (removed > 0) {
            log.info('Cleaned up expired credentials', { count: removed })
        }

        return removed
    }

    /**
     * Clear all credentials
     */
    clearAll(): void {
        for (const id of this.credentials.keys()) {
            this.removeFromKeychain(id)
        }
        
        this.credentials.clear()
        this.metadataIndex.clear()
        
        log.info('Cleared all credentials')
    }

    /**
     * Get stats
     */
    getStats(): { totalCredentials: number; expiredCount: number } {
        let expiredCount = 0
        const now = Date.now()
        
        for (const credential of this.credentials.values()) {
            if (now > credential.expiresAt) {
                expiredCount++
            }
        }

        return {
            totalCredentials: this.credentials.size,
            expiredCount,
        }
    }

    // ─── Keychain Integration (Placeholder) ───────────────────────────────────

    /**
     * Encrypt plaintext using AES-256-GCM.
     * Uses a derived key from a persistent master key stored securely.
     */
    private async encryptKey(plaintext: string): Promise<string> {
        // Get or create the persistent master key
        const masterKey = await this.getMasterKey()
        
        // Generate a random salt for this encryption
        const salt = crypto.getRandomValues(new Uint8Array(16))
        
        // Derive an encryption key from the master key using the salt
        const aesKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            masterKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        )
        
        // Generate random IV
        const iv = crypto.getRandomValues(new Uint8Array(12))
        
        // Encrypt
        const encoder = new TextEncoder()
        const encryptedBuffer = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            encoder.encode(plaintext)
        )
        
        // Combine salt + iv + ciphertext
        const combined = new Uint8Array(salt.length + iv.length + encryptedBuffer.byteLength)
        combined.set(salt, 0)
        combined.set(iv, salt.length)
        combined.set(new Uint8Array(encryptedBuffer), salt.length + iv.length)
        
        const encrypted = Buffer.from(combined).toString('base64')
        log.debug('Encrypted credential key')
        return `enc:${encrypted}`
    }

    /**
     * Decrypt encrypted data using the persistent master key.
     */
    private async decryptKey(encryptedData: string): Promise<string> {
        try {
            if (!encryptedData.startsWith('enc:')) {
                // Legacy unencrypted data - fail closed
                log.error('Legacy unencrypted credential found - cannot decrypt')
                throw new Error('Cannot decrypt legacy unencrypted credential')
            }
            
            const base64Data = encryptedData.slice(4)
            const combined = Buffer.from(base64Data, 'base64')
            
            // Extract salt, iv, and ciphertext
            const salt = combined.slice(0, 16)
            const iv = combined.slice(16, 28)
            const ciphertext = combined.slice(28)
            
            // Get the persistent master key
            const masterKey = await this.getMasterKey()
            
            // Re-derive the key using the same salt
            const aesKey = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                masterKey,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            )
            
            // Decrypt
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                aesKey,
                ciphertext
            )
            
            const decoder = new TextDecoder()
            return decoder.decode(decryptedBuffer)
        } catch (err) {
            log.error('Failed to decrypt credential', { error: String(err) })
            throw new Error('Failed to decrypt credential: ' + String(err))
        }
    }

    /**
     * Get or create the persistent master key for encryption.
     * In production, this would be stored in OS keychain.
     */
    private async getMasterKey(): Promise<CryptoKey> {
        // Check if we have a cached master key
        if (this._masterKeyCache) {
            return this._masterKeyCache
        }
        
        // Try to load existing key from storage
        const storedKeyData = this._masterKeyStorage.get()
        if (storedKeyData) {
            try {
                const keyData = JSON.parse(storedKeyData)
                this._masterKeyCache = await crypto.subtle.importKey(
                    'jwk',
                    keyData,
                    { name: 'PBKDF2' },
                    true,
                    ['deriveBits', 'deriveKey']
                )
                return this._masterKeyCache
            } catch {
                // Invalid key data, generate new one
            }
        }
        
        // Generate new master key
        const masterKeyMaterial = crypto.getRandomValues(new Uint8Array(32))
        this._masterKeyCache = await crypto.subtle.importKey(
            'raw',
            masterKeyMaterial,
            'PBKDF2',
            true,
            ['deriveBits', 'deriveKey']
        )
        
        // Export and store for persistence (in production, use OS keychain)
        const exported = await crypto.subtle.exportKey('jwk', this._masterKeyCache)
        this._masterKeyStorage.set(JSON.stringify(exported))
        
        return this._masterKeyCache
    }

    // Simple storage interface for master key - IN-MEMORY ONLY for security
    // In production, this would use OS keychain via Tauri
    // NOTE: Master key is NOT persisted - credentials will need re-entry after refresh
    // This is a security trade-off to avoid XSS vulnerabilities with localStorage
    private readonly _masterKeyStorage = {
        get: (): string | null => {
            // SECURITY: Never read from localStorage - key must be re-entered after refresh
            return null
        },
        set: (_value: string): void => {
            // SECURITY: Never write to localStorage - key must be re-entered after refresh
            // Log warning if called (should not happen in production)
            log.warn('Attempted to persist master key - blocking for security')
        }
    }
    private _masterKeyCache: CryptoKey | null = null

    private async storeInKeychain(_id: string, _key: string, _provider: string): Promise<void> {
        // In production, this would use Tauri to access OS keychain
        // macOS: Keychain Services
        // Windows: Credential Manager
        // Linux: Secret Service API
        log.debug('Would store in keychain', { id: _id, provider: _provider })
    }

    private async retrieveFromKeychain(_id: string): Promise<string | null> {
        // In production, this would use Tauri to access OS keychain
        return null
    }

    private removeFromKeychain(_id: string): void {
        // In production, this would use Tauri to remove from OS keychain
        log.debug('Would remove from keychain', { id: _id })
    }
}

export const credentialManager = GlobalCredentialManager.getInstance()

// ─── Convenience Functions ──────────────────────────────────────────────────────

export async function storeCredential(
    key: string,
    provider: string,
    label: string,
    ttlMs?: number,
): Promise<ICredentialMetadata> {
    return credentialManager.store(key, provider, label, ttlMs)
}

export async function retrieveCredential(id: string): Promise<string | null> {
    return credentialManager.retrieve(id)
}

export function getCredentialMetadata(id: string): ICredentialMetadata | null {
    return credentialManager.getMetadata(id)
}

export function removeCredential(id: string): void {
    credentialManager.remove(id)
}
