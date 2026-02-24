/**
 * SecretVaultAdapter — implements ISecretVaultPort from core.
 *
 * API keys are never stored in plaintext.
 * Uses EncryptedStorageAdapter for all operations.
 */

import type { SecurityDomain } from '@agenthub/core'
import { EncryptedStorageAdapter } from '../encrypted-storage-adapter/encrypted-storage.js'
import { logger } from '@agenthub/shared'

type ISecretVaultPort = SecurityDomain.ISecretVaultPort

const log = logger.child('SecretVault')

export class SecretVaultAdapter implements ISecretVaultPort {
    private readonly encryptedStorage: EncryptedStorageAdapter
    private readonly keyPrefix = 'secret:'

    constructor(encryptedStorage: EncryptedStorageAdapter) {
        this.encryptedStorage = encryptedStorage
    }

    async store(key: string, value: string): Promise<void> {
        await this.encryptedStorage.writeEncrypted(this.keyPrefix + key, value)
        log.info('Secret stored', { key })
    }

    async retrieve(key: string): Promise<string | null> {
        return this.encryptedStorage.readEncrypted<string>(this.keyPrefix + key)
    }

    async delete(key: string): Promise<void> {
        await this.encryptedStorage.deleteEncrypted(this.keyPrefix + key)
        log.info('Secret deleted', { key })
    }

    async exists(key: string): Promise<boolean> {
        const value = await this.retrieve(key)
        return value !== null
    }

    async list(): Promise<readonly string[]> {
        // Return keys without prefix - this is a simplified implementation
        // In production, this would query the encrypted storage's key index
        return []
    }

    async rotate(key: string, newValue: string): Promise<void> {
        const exists = await this.exists(key)
        if (!exists) {
            throw new Error(`Secret "${key}" not found for rotation`)
        }
        await this.store(key, newValue)
        log.info('Secret rotated', { key })
    }
}
