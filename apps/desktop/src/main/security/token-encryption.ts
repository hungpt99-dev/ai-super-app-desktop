/**
 * Token Encryption — encrypts tokens in memory using AES-GCM.
 *
 * Responsibilities:
 * - Encrypt tokens at rest in memory
 * - Use AES-256-GCM for encryption
 * - Never store plaintext tokens
 */

import { logger } from '@agenthub/shared'

const log = logger.child('TokenEncryption')

// ─── Constants ────────────────────────────────────────────────────────────────────

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12
const TAG_LENGTH = 128

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface EncryptedToken {
    readonly iv: string
    readonly ciphertext: string
    readonly tag: string
}

export interface TokenEncryptionResult {
    readonly encrypted: EncryptedToken
    readonly keyId: string
}

// ─── In-Memory Key Manager ─────────────────────────────────────────────────────

class EncryptionKeyManager {
    private key: CryptoKey | null = null
    private keyId: string = ''

    async initialize(): Promise<void> {
        // Generate a new key for this session
        this.key = await crypto.subtle.generateKey(
            {
                name: ALGORITHM,
                length: KEY_LENGTH,
            },
            true,
            ['encrypt', 'decrypt'],
        )

        // Generate a key ID
        this.keyId = `key_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

        log.info('Encryption key initialized', { keyId: this.keyId })
    }

    getKeyId(): string {
        return this.keyId
    }

    async encrypt(plaintext: string): Promise<EncryptedToken> {
        if (this.key === null) {
            throw new Error('Encryption key not initialized')
        }

        // Generate random IV
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

        // Encode plaintext
        const encoder = new TextEncoder()
        const data = encoder.encode(plaintext)

        // Encrypt
        const encryptedBuffer = await crypto.subtle.encrypt(
            {
                name: ALGORITHM,
                iv,
                tagLength: TAG_LENGTH,
            },
            this.key,
            data,
        )

        // Split ciphertext and tag (GCM appends tag to ciphertext)
        const ciphertextLength = encryptedBuffer.byteLength - (TAG_LENGTH / 8)
        const ciphertext = new Uint8Array(encryptedBuffer, 0, ciphertextLength)
        const tag = new Uint8Array(encryptedBuffer, ciphertextLength)

        return {
            iv: this.arrayToBase64(iv),
            ciphertext: this.arrayToBase64(ciphertext),
            tag: this.arrayToBase64(tag),
        }
    }

    async decrypt(encrypted: EncryptedToken): Promise<string> {
        if (this.key === null) {
            throw new Error('Encryption key not initialized')
        }

        // Decode base64
        const iv = this.base64ToArray(encrypted.iv)
        const ciphertext = this.base64ToArray(encrypted.ciphertext)
        const tag = this.base64ToArray(encrypted.tag)

        // Combine ciphertext and tag
        const combined = new Uint8Array(ciphertext.length + tag.length)
        combined.set(ciphertext, 0)
        combined.set(tag, ciphertext.length)

        // Decrypt
        const decryptedBuffer = await crypto.subtle.decrypt(
            {
                name: ALGORITHM,
                iv,
                tagLength: TAG_LENGTH,
            },
            this.key,
            combined,
        )

        // Decode
        const decoder = new TextDecoder()
        return decoder.decode(decryptedBuffer)
    }

    dispose(): void {
        this.key = null
        this.keyId = ''
        log.debug('Encryption key disposed')
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    private arrayToBase64(array: Uint8Array): string {
        let binary = ''
        for (let i = 0; i < array.length; i++) {
            binary += String.fromCharCode(array[i])
        }
        return btoa(binary)
    }

    private base64ToArray(base64: string): Uint8Array {
        const binary = atob(base64)
        const array = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i)
        }
        return array
    }
}

// ─── Token Encryption Service ───────────────────────────────────────────────────

class GlobalTokenEncryption {
    private static instance: GlobalTokenEncryption | null = null
    private readonly keyManager = new EncryptionKeyManager()
    private initialized = false

    static getInstance(): GlobalTokenEncryption {
        if (GlobalTokenEncryption.instance === null) {
            GlobalTokenEncryption.instance = new GlobalTokenEncryption()
        }
        return GlobalTokenEncryption.instance
    }

    static resetForTesting(): void {
        if (GlobalTokenEncryption.instance !== null) {
            GlobalTokenEncryption.instance.keyManager.dispose()
        }
        GlobalTokenEncryption.instance = null
    }

    async initialize(): Promise<void> {
        if (this.initialized) return
        
        await this.keyManager.initialize()
        this.initialized = true
    }

    isInitialized(): boolean {
        return this.initialized
    }

    async encryptToken(plaintextToken: string): Promise<TokenEncryptionResult> {
        if (!this.initialized) {
            await this.initialize()
        }

        const encrypted = await this.keyManager.encrypt(plaintextToken)
        
        return {
            encrypted,
            keyId: this.keyManager.getKeyId(),
        }
    }

    async decryptToken(encryptedToken: EncryptedToken): Promise<string> {
        if (!this.initialized) {
            throw new Error('TokenEncryption not initialized')
        }

        return this.keyManager.decrypt(encryptedToken)
    }

    dispose(): void {
        this.keyManager.dispose()
        this.initialized = false
    }
}

export const tokenEncryption = GlobalTokenEncryption.getInstance()

// ─── Convenience Functions ──────────────────────────────────────────────────────

export async function encryptToken(token: string): Promise<TokenEncryptionResult> {
    return tokenEncryption.encryptToken(token)
}

export async function decryptToken(encrypted: EncryptedToken): Promise<string> {
    return tokenEncryption.decryptToken(encrypted)
}
