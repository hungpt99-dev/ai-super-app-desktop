/**
 * local-memory.ts
 *
 * Low-level invoke() wrappers around the Rust `memory_*` Tauri commands.
 * Everything is stored on the user's machine in an embedded SQLite database
 * — nothing is sent to any server.
 *
 * Use `SandboxedMemory` (sandboxed-memory.ts) to expose this through
 * the module context, as it enforces permission checks.
 *
 * DB location:
 *   macOS   → ~/Library/Application Support/com.agenthub.desktop/memory.db
 *   Linux   → ~/.local/share/com.agenthub.desktop/memory.db
 *   Windows → %APPDATA%\com.agenthub.desktop\memory.db
 */

import type {
  IConversationMessage,
  IMemoryEntry,
  IMemoryStats,
  IMemoryUpsertInput,
} from '@agenthub/sdk'

import { logger } from '@agenthub/shared'

const log = logger.child('LocalMemory')

/**
 * Insert or update a memory entry.
 */
export async function memoryUpsert(input: IMemoryUpsertInput): Promise<IMemoryEntry> {
  log.warn('Memory storage not yet available in renderer - using mock')
  return {
    id: 'stub',
    type: input.type || 'fact',
    scope: input.scope || 'private',
    title: input.title,
    content: input.content,
    source: input.source || 'user',
    accessCount: 0,
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accessedAt: null
  } as IMemoryEntry
}

/**
 * List active (non-archived) memories.
 */
export async function memoryList(options?: {
  scope?: string
  memoryType?: string
  limit?: number
}): Promise<IMemoryEntry[]> {
  return []
}

/** Get a single memory by ID. */
export async function memoryGet(id: string): Promise<IMemoryEntry> {
  throw new Error(`Memory not found: ${id}`)
}

/** Soft-delete (archive) a memory by ID. */
export async function memoryDelete(id: string): Promise<void> {
  return
}

/** Permanently remove all archived memories. */
export async function memoryPurgeArchived(): Promise<number> {
  return 0
}

/**
 * Build a formatted system-prompt block from active memories.
 */
export async function memoryBuildContext(options?: {
  scope?: string
  maxEntries?: number
}): Promise<string> {
  return ''
}

/** Return memory statistics. */
export async function memoryStats(): Promise<IMemoryStats> {
  return {
    totalMemories: 0,
    totalMessages: 0,
    byType: {}
  }
}

// ── Conversation history ───────────────────────────────────────────────────────

/**
 * Append messages to a session.
 */
export async function memoryAppendMessages(
  sessionId: string,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
): Promise<void> {
  return
}

/**
 * Return the most recent `limit` messages for a session.
 */
export async function memoryGetHistory(
  sessionId: string,
  limit?: number,
): Promise<IConversationMessage[]> {
  return []
}

/** Clear all messages for a session. */
export async function memoryClearSession(sessionId: string): Promise<void> {
  return
}
