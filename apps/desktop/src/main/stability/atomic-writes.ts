/**
 * Atomic Writes — ensures file writes don't corrupt data.
 *
 * Responsibilities:
 * - Write to temp file first
 * - Rename to target file atomically
 * - Handle failures gracefully
 * - Support graceful storage degradation
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from '@agenthub/shared'

const log = logger.child('AtomicWrites')

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface AtomicWriteOptions {
    readonly tempPrefix?: string
    readonly tempSuffix?: string
    readonly mode?: number
    readonly encoding?: BufferEncoding
}

export interface AtomicWriteResult {
    readonly success: boolean
    readonly path?: string
    readonly error?: string
}

// ─── Atomic Write Implementation ────────────────────────────────────────────────

export class AtomicFileWriter {
    /**
     * Write data atomically using temp file + rename pattern
     */
    static async write(
        targetPath: string,
        data: string | Buffer,
        options: AtomicWriteOptions = {},
    ): Promise<AtomicWriteResult> {
        const tempPrefix = options.tempPrefix ?? '.tmp'
        const tempSuffix = options.tempSuffix ?? `.${Date.now()}.tmp`
        const dir = path.dirname(targetPath)
        const filename = path.basename(targetPath)

        const tempPath = path.join(dir, `${tempPrefix}${filename}${tempSuffix}`)

        try {
            // Ensure directory exists
            await fs.mkdir(dir, { recursive: true })

            // Write to temp file
            await fs.writeFile(tempPath, data, {
                encoding: options.encoding,
                mode: options.mode,
                flags: 'wx', // Exclusive create - fail if exists
            })

            // Atomic rename
            await fs.rename(tempPath, targetPath)

            log.debug('Atomic write completed', { targetPath })

            return {
                success: true,
                path: targetPath,
            }
        } catch (err) {
            // Clean up temp file if it exists
            try {
                await fs.unlink(tempPath)
            } catch {
                // Ignore cleanup errors
            }

            const errorMessage = err instanceof Error ? err.message : String(err)
            log.error('Atomic write failed', { targetPath, tempPath, error: errorMessage })

            return {
                success: false,
                error: errorMessage,
            }
        }
    }

    /**
     * Read with fallback to memory if file doesn't exist
     */
    static async read(
        targetPath: string,
        _fallbackData?: string,
        encoding: BufferEncoding = 'utf-8',
    ): Promise<{ success: boolean; data?: string; error?: string }> {
        try {
            const data = await fs.readFile(targetPath, { encoding })
            return {
                success: true,
                data,
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err)
            
            // Check if it's a "not found" error
            if (errorMessage.includes('ENOENT')) {
                return {
                    success: false,
                    error: 'File not found',
                }
            }

            log.error('Atomic read failed', { targetPath, error: errorMessage })
            
            return {
                success: false,
                error: errorMessage,
            }
        }
    }

    /**
     * Delete file safely
     */
    static async delete(targetPath: string): Promise<boolean> {
        try {
            await fs.unlink(targetPath)
            log.debug('File deleted', { targetPath })
            return true
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err)
            
            // Not found is considered success
            if (errorMessage.includes('ENOENT')) {
                return true
            }

            log.warn('File deletion failed', { targetPath, error: errorMessage })
            return false
        }
    }
}

// ─── Storage Fallback Manager ─────────────────────────────────────────────────

class StorageFallbackManager {
    private readonly memoryFallback = new Map<string, string | Buffer>()
    private primaryFailed = false

    isPrimaryFailed(): boolean {
        return this.primaryFailed
    }

    setPrimaryFailed(failed: boolean): void {
        this.primaryFailed = failed
        log.info('Storage primary status changed', { failed })
    }

    /**
     * Write to fallback storage (memory)
     */
    writeFallback(key: string, data: string | Buffer): void {
        this.memoryFallback.set(key, data)
        log.debug('Written to memory fallback', { key })
    }

    /**
     * Read from fallback storage
     */
    readFallback(key: string): string | Buffer | undefined {
        return this.memoryFallback.get(key)
    }

    /**
     * Delete from fallback storage
     */
    deleteFallback(key: string): void {
        this.memoryFallback.delete(key)
    }

    /**
     * Get all fallback keys
     */
    getFallbackKeys(): string[] {
        return Array.from(this.memoryFallback.keys())
    }

    /**
     * Clear fallback storage
     */
    clearFallback(): void {
        this.memoryFallback.clear()
        log.info('Cleared memory fallback storage')
    }

    /**
     * Sync fallback to primary storage
     */
    async syncToPrimary(writeFn: (key: string, data: string | Buffer) => Promise<boolean>): Promise<number> {
        let synced = 0
        
        for (const [key, data] of this.memoryFallback.entries()) {
            const success = await writeFn(key, data)
            if (success) {
                this.memoryFallback.delete(key)
                synced++
            }
        }

        if (synced > 0) {
            log.info('Synced fallback to primary', { count: synced })
        }

        return synced
    }
}

let fallbackManagerInstance: StorageFallbackManager | null = null

export function getStorageFallbackManager(): StorageFallbackManager {
    if (fallbackManagerInstance === null) {
        fallbackManagerInstance = new StorageFallbackManager()
    }
    return fallbackManagerInstance
}
