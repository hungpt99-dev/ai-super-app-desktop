import Database from 'better-sqlite3'
import type { Database as SqliteDatabase } from 'better-sqlite3'
import type { MemoryType, IMemoryEntry as ISdkMemoryEntry, IConversationMessage as ISdkConversationMessage } from '@agenthub/sdk'

export interface IMemoryEntry extends Omit<ISdkMemoryEntry, 'type'> {
    type: MemoryType
}

export type IConversationMessage = ISdkConversationMessage

export class SqliteMemoryStore {
    private db: SqliteDatabase

    constructor(dbPath: string) {
        this.db = new Database(dbPath)
        this.initSchema()
    }

    private initSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                scope TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                source TEXT NOT NULL,
                access_count INTEGER DEFAULT 0,
                archived INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                accessed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
            CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
        `)
    }

    async upsertMemory(input: Partial<IMemoryEntry>): Promise<IMemoryEntry> {
        const id = input.id || crypto.randomUUID()
        const now = new Date().toISOString()

        const stmt = this.db.prepare(`
            INSERT INTO memories (id, type, scope, title, content, source, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                type = excluded.type,
                scope = excluded.scope,
                title = excluded.title,
                content = excluded.content,
                source = excluded.source,
                updated_at = excluded.updated_at
        `)

        stmt.run(id, input.type, input.scope, input.title, input.content, input.source, now)
        return this.getMemory(id) as Promise<IMemoryEntry>
    }

    async getMemory(id: string): Promise<IMemoryEntry | null> {
        const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as any
        if (!row) return null
        return this.mapMemory(row)
    }

    async listMemories(scope?: string): Promise<IMemoryEntry[]> {
        let sql = 'SELECT * FROM memories WHERE archived = 0'
        const params: any[] = []
        if (scope) {
            sql += ' AND scope = ?'
            params.push(scope)
        }
        sql += ' ORDER BY access_count DESC, created_at DESC'
        const rows = this.db.prepare(sql).all(...params) as any[]
        return rows.map(r => this.mapMemory(r))
    }

    async deleteMemory(id: string): Promise<void> {
        this.db.prepare('UPDATE memories SET archived = 1 WHERE id = ?').run(id)
    }

    async appendMessages(sessionId: string, messages: any[]): Promise<void> {
        const stmt = this.db.prepare('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)')
        for (const msg of messages) {
            stmt.run(crypto.randomUUID(), sessionId, msg.role, msg.content)
        }
    }

    async getHistory(sessionId: string, limit: number = 50): Promise<IConversationMessage[]> {
        const rows = this.db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?')
            .all(sessionId, limit) as any[]
        return rows.map(r => ({
            id: r.id,
            sessionId: r.session_id,
            role: r.role,
            content: r.content,
            createdAt: r.created_at
        }))
    }

    private mapMemory(row: any): IMemoryEntry {
        return {
            id: row.id,
            scope: row.scope,
            title: row.title,
            content: row.content,
            source: row.source,
            accessCount: row.access_count,
            archived: row.archived === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            accessedAt: row.accessed_at,
            type: row.type as MemoryType
        }
    }
}
