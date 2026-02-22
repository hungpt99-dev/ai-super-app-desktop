import crypto from 'crypto'
import type { Database as SqliteDatabase } from 'better-sqlite3'
import type { ISecretVault } from '../index.js'

/**
 * SQLite-backed encrypted secret vault.
 * Uses AES-256-GCM to encrypt all secrets at rest.
 */
export class SqliteSecretVault implements ISecretVault {
    private encryptionKey: Buffer

    constructor(
        private readonly db: SqliteDatabase,
        base64Key: string
    ) {
        this.encryptionKey = Buffer.from(base64Key, 'base64')
        if (this.encryptionKey.length !== 32) {
            throw new Error('SqliteSecretVault requires a 256-bit (32 byte) key in base64 format.')
        }
        this.initSchema()
    }

    private initSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS secret_vault (
        name TEXT PRIMARY KEY,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        ciphertext TEXT NOT NULL
      )
    `)
    }

    private encrypt(value: string) {
        const iv = crypto.randomBytes(12)
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv)
        const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
        const authTag = cipher.getAuthTag()

        return {
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64'),
            ciphertext: ciphertext.toString('base64'),
        }
    }

    private decrypt(iv64: string, authTag64: string, ciphertext64: string): string {
        const iv = Buffer.from(iv64, 'base64')
        const authTag = Buffer.from(authTag64, 'base64')
        const ciphertext = Buffer.from(ciphertext64, 'base64')

        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv)
        decipher.setAuthTag(authTag)
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

        return decrypted.toString('utf8')
    }

    async put(name: string, value: string): Promise<void> {
        const { iv, authTag, ciphertext } = this.encrypt(value)
        const stmt = this.db.prepare(`
      INSERT INTO secret_vault (name, iv, auth_tag, ciphertext)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        iv = excluded.iv,
        auth_tag = excluded.auth_tag,
        ciphertext = excluded.ciphertext
    `)
        stmt.run(name, iv, authTag, ciphertext)
    }

    async get(name: string): Promise<string | null> {
        const stmt = this.db.prepare('SELECT iv, auth_tag, ciphertext FROM secret_vault WHERE name = ?')
        const row = stmt.get(name) as { iv: string; auth_tag: string; ciphertext: string } | undefined
        if (!row) return null

        try {
            return this.decrypt(row.iv, row.auth_tag, row.ciphertext)
        } catch {
            return null // Decryption failed (bad key, corrupted, etc)
        }
    }

    async delete(name: string): Promise<void> {
        const stmt = this.db.prepare('DELETE FROM secret_vault WHERE name = ?')
        stmt.run(name)
    }

    async list(): Promise<string[]> {
        const stmt = this.db.prepare('SELECT name FROM secret_vault')
        const rows = stmt.all() as { name: string }[]
        return rows.map((r) => r.name)
    }

    async has(name: string): Promise<boolean> {
        const stmt = this.db.prepare('SELECT 1 FROM secret_vault WHERE name = ?')
        const row = stmt.get(name)
        return row !== undefined
    }
}
