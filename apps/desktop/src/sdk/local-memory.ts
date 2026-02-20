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
 *   macOS   → ~/Library/Application Support/com.ai-super-app.desktop/memory.db
 *   Linux   → ~/.local/share/com.ai-super-app.desktop/memory.db
 *   Windows → %APPDATA%\com.ai-super-app.desktop\memory.db
 */

import { invoke } from '@tauri-apps/api/core'
import type {
  IConversationMessage,
  IMemoryEntry,
  IMemoryStats,
  IMemoryUpsertInput,
  MemoryType,
} from '@ai-super-app/sdk'

// ── Raw Tauri response shapes (snake_case from Rust) ──────────────────────────

interface RawMemoryEntry {
  id: string
  type: string
  scope: string
  title: string
  content: string
  source: string
  access_count: number
  archived: boolean
  created_at: string
  updated_at: string
  accessed_at: string | null
}

interface RawConversationMessage {
  id: string
  session_id: string
  role: string
  content: string
  created_at: string
}

interface RawMemoryStats {
  total_memories: number
  total_messages: number
  by_type: Record<string, number>
}

// ── Converters ────────────────────────────────────────────────────────────────

function toMemoryEntry(raw: RawMemoryEntry): IMemoryEntry {
  return {
    id: raw.id,
    type: raw.type as MemoryType,
    scope: raw.scope,
    title: raw.title,
    content: raw.content,
    source: raw.source,
    accessCount: raw.access_count,
    archived: raw.archived,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    accessedAt: raw.accessed_at,
  }
}

function toConversationMessage(raw: RawConversationMessage): IConversationMessage {
  return {
    id: raw.id,
    sessionId: raw.session_id,
    role: raw.role as 'user' | 'assistant' | 'system',
    content: raw.content,
    createdAt: raw.created_at,
  }
}

function toMemoryStats(raw: RawMemoryStats): IMemoryStats {
  return {
    totalMemories: raw.total_memories,
    totalMessages: raw.total_messages,
    byType: raw.by_type as Partial<Record<MemoryType, number>>,
  }
}

// ── Memory CRUD ───────────────────────────────────────────────────────────────

/**
 * Insert or update a memory entry.
 * If a memory with the same `title` (case-insensitive) already exists it
 * is updated in place; otherwise a new row is inserted.
 */
export async function memoryUpsert(input: IMemoryUpsertInput): Promise<IMemoryEntry> {
  const raw = await invoke<RawMemoryEntry>('memory_upsert', { input })
  return toMemoryEntry(raw)
}

/**
 * List active (non-archived) memories.
 * Results are ordered by access count descending, then creation date.
 */
export async function memoryList(options?: {
  scope?: string
  memoryType?: string
  limit?: number
}): Promise<IMemoryEntry[]> {
  const raw = await invoke<RawMemoryEntry[]>('memory_list', {
    scope: options?.scope ?? null,
    memoryType: options?.memoryType ?? null,
    limit: options?.limit ?? null,
  })
  return raw.map(toMemoryEntry)
}

/** Get a single memory by ID. */
export async function memoryGet(id: string): Promise<IMemoryEntry> {
  const raw = await invoke<RawMemoryEntry>('memory_get', { id })
  return toMemoryEntry(raw)
}

/** Soft-delete (archive) a memory by ID. */
export async function memoryDelete(id: string): Promise<void> {
  await invoke<void>('memory_delete', { id })
}

/** Permanently remove all archived memories. Returns the number deleted. */
export async function memoryPurgeArchived(): Promise<number> {
  return invoke<number>('memory_purge_archived')
}

/**
 * Build a formatted system-prompt block from active memories.
 * The returned string is ready to be prepended to any AI request.
 * Increments access counters for included entries.
 */
export async function memoryBuildContext(options?: {
  scope?: string
  maxEntries?: number
}): Promise<string> {
  return invoke<string>('memory_build_context', {
    scope: options?.scope ?? null,
    maxEntries: options?.maxEntries ?? null,
  })
}

/** Return memory statistics (counts by type, total messages). */
export async function memoryStats(): Promise<IMemoryStats> {
  const raw = await invoke<RawMemoryStats>('memory_stats')
  return toMemoryStats(raw)
}

// ── Conversation history ───────────────────────────────────────────────────────

/**
 * Append messages to a session.
 * `sessionId` should be a stable UUID per chat window — e.g. generated once
 * with `crypto.randomUUID()` when the window is opened.
 */
export async function memoryAppendMessages(
  sessionId: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
): Promise<void> {
  await invoke<void>('memory_append_messages', {
    sessionId,
    messages,
  })
}

/**
 * Return the most recent `limit` messages for a session in chronological order.
 * Defaults to the last 40 messages.
 */
export async function memoryGetHistory(
  sessionId: string,
  limit?: number,
): Promise<IConversationMessage[]> {
  const raw = await invoke<RawConversationMessage[]>('memory_get_history', {
    sessionId,
    limit: limit ?? null,
  })
  return raw.map(toConversationMessage)
}

/** Clear all messages for a session (e.g. when the user resets a chat). */
export async function memoryClearSession(sessionId: string): Promise<void> {
  await invoke<void>('memory_clear_session', { sessionId })
}
