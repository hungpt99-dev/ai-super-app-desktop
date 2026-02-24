/**
 * EncryptedStorageAdapter — implements IEncryptedStoragePort from core.
 *
 * Uses Web Crypto API for encryption/decryption.
 * All API keys and secrets are encrypted before storage.
 */

import type { SecurityDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type IEncryptedStoragePort = SecurityDomain.IEncryptedStoragePort

const log = logger.child('EncryptedStorage')

export class EncryptedStorageAdapter implements IEncryptedStoragePort {
    private readonly store: Map<string, string> = new Map()
    private encryptionKey: CryptoKey | null = null

    async initialize(passphrase: string): Promise<void> {
        const encoder = new TextEncoder()
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(passphrase),
            'PBKDF2',
            false,
            ['deriveKey'],
        )

        this.encryptionKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('agenthub-salt-v1'),
                iterations: 100_000,
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt'],
        )

        log.info('Encrypted storage initialized')
    }

    async encrypt(plaintext: string): Promise<string> {
        if (!this.encryptionKey) {
            throw new Error('Encrypted storage not initialized')
        }

        const encoder = new TextEncoder()
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            this.encryptionKey,
            encoder.encode(plaintext),
        )

        const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length)
        combined.set(iv)
        combined.set(new Uint8Array(encrypted), iv.length)

        return this.bufferToBase64(combined)
    }

    async decrypt(ciphertext: string): Promise<string> {
        if (!this.encryptionKey) {
            throw new Error('Encrypted storage not initialized')
        }

        const combined = this.base64ToBuffer(ciphertext)
        const iv = combined.slice(0, 12)
        const data = combined.slice(12)

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            this.encryptionKey,
            data,
        )

        const decoder = new TextDecoder()
        return decoder.decode(decrypted)
    }

    async writeEncrypted(key: string, data: unknown): Promise<void> {
        const plaintext = JSON.stringify(data)
        const encrypted = await this.encrypt(plaintext)
        this.store.set(key, encrypted)
    }

    async readEncrypted<T>(key: string): Promise<T | null> {
        const encrypted = this.store.get(key)
        if (!encrypted) return null

        const plaintext = await this.decrypt(encrypted)
        return JSON.parse(plaintext) as T
    }

    async deleteEncrypted(key: string): Promise<void> {
        this.store.delete(key)
    }

    private bufferToBase64(buffer: Uint8Array): string {
        let binary = ''
        for (const byte of buffer) {
            binary += String.fromCharCode(byte)
        }
        return btoa(binary)
    }

    private base64ToBuffer(base64: string): Uint8Array {
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
        }
        return bytes
    }
}
