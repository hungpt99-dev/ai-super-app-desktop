import Database from 'better-sqlite3'
import type { Database as SqliteDatabase } from 'better-sqlite3'
import type { IStorageAdapter, IRelationalStore } from '../index.js'

/**
 * SQLite-backed storage adapter using better-sqlite3.
 * Automatically initializes a simple key-value table.
 */
export class StorageSqliteAdapter implements IStorageAdapter, IRelationalStore {
    private db: SqliteDatabase

    constructor(dbPath: string = ':memory:') {
        this.db = new Database(dbPath)
        this.db.pragma('journal_mode = WAL')
        this.initSchema()
    }

    private initSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
    }

    // ─── IStorageAdapter ──────────────────────────────────────────────────────

    async get<T>(key: string): Promise<T | null> {
        const stmt = this.db.prepare('SELECT value FROM kv_store WHERE key = ?')
        const row = stmt.get(key) as { value: string } | undefined
        if (!row) return null
        try {
            return JSON.parse(row.value) as T
        } catch {
            return row.value as T
        }
    }

    async set<T>(key: string, value: T): Promise<void> {
        const stmt = this.db.prepare(`
      INSERT INTO kv_store (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
        const valString = typeof value === 'string' ? value : JSON.stringify(value)
        stmt.run(key, valString)
    }

    async delete(key: string): Promise<void> {
        const stmt = this.db.prepare('DELETE FROM kv_store WHERE key = ?')
        stmt.run(key)
    }

    async has(key: string): Promise<boolean> {
        const stmt = this.db.prepare('SELECT 1 FROM kv_store WHERE key = ?')
        const row = stmt.get(key)
        return row !== undefined
    }

    async keys(prefix?: string): Promise<string[]> {
        if (prefix) {
            const stmt = this.db.prepare('SELECT key FROM kv_store WHERE key LIKE ?')
            const rows = stmt.all(`${prefix}%`) as { key: string }[]
            return rows.map((r) => r.key)
        }
        const stmt = this.db.prepare('SELECT key FROM kv_store')
        const rows = stmt.all() as { key: string }[]
        return rows.map((r) => r.key)
    }

    async clear(): Promise<void> {
        const stmt = this.db.prepare('DELETE FROM kv_store')
        stmt.run()
    }

    // ─── IRelationalStore ─────────────────────────────────────────────────────

    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
        const stmt = this.db.prepare(sql)
        return stmt.all(...params) as T[]
    }

    async execute(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number }> {
        const stmt = this.db.prepare(sql)
        const info = stmt.run(...params)
        return { rowsAffected: info.changes }
    }

    /** Expose for graceful shutdown */
    close(): void {
        this.db.close()
    }
}
