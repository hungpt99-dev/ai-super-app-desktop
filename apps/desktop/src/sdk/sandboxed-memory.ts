/**
 * sandboxed-memory.ts
 *
 * Permission-enforced proxy around all local-memory operations.
 * Modules receive this instance as `ctx.memory`.
 *
 * Scope enforcement (layered memory architecture):
 * ─────────────────────────────────────────────────
 * • "private"  → stored as `bot:{moduleId}`       — default, always writable
 * • "shared"   → stored as `workspace:shared`     — readable always; write needs MemorySharedWrite
 * • "task"     → stored as `task:{taskRunId}`     — ephemeral; auto-cleared when run ends
 *
 * If the caller passes a raw scope string it is used as-is so the runtime can
 * write task scopes directly (e.g. `task:runId`).
 *
 * Permission mapping:
 * - upsert, delete, appendMessages, clearSession → Permission.MemoryWrite
 *   (shared scope upsert additionally requires Permission.MemorySharedWrite)
 * - list, get, buildContext, stats, getHistory   → Permission.MemoryRead
 */

import type {
  IConversationMessage,
  IMemoryAPI,
  IMemoryEntry,
  IMemoryStats,
  IMemoryUpsertInput,
  MemoryType,
} from '@agenthub/sdk'
import { Permission } from '@agenthub/sdk'
import type { PermissionEngine } from '../core/permission-engine.js'
import * as LM from './local-memory.js'

const SHARED_SCOPE = 'workspace:shared'

/** Resolve the logical scope name into the stored scope string. */
function resolveScope(
  scope: string | undefined,
  moduleId: string,
): string {
  if (scope === undefined || scope === 'private') return `bot:${moduleId}`
  if (scope === 'shared') return SHARED_SCOPE
  // Anything else (e.g. 'task:run-123', or a raw 'bot:...' string from the runtime) passes through.
  return scope
}

export class SandboxedMemory implements IMemoryAPI {
  constructor(
    private readonly moduleId: string,
    private readonly permissionEngine: PermissionEngine,
  ) {}

  // ── Write operations (Permission.MemoryWrite) ─────────────────────────────

  async upsert(input: IMemoryUpsertInput): Promise<IMemoryEntry> {
    this.check(Permission.MemoryWrite)
    const resolved = resolveScope(input.scope, this.moduleId)
    // Shared scope requires an extra permission.
    if (resolved === SHARED_SCOPE) {
      this.check(Permission.MemorySharedWrite)
    }
    return LM.memoryUpsert({ ...input, scope: resolved })
  }

  async delete(id: string): Promise<void> {
    this.check(Permission.MemoryWrite)
    return LM.memoryDelete(id)
  }

  async appendMessages(
    sessionId: string,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  ): Promise<void> {
    this.check(Permission.MemoryWrite)
    return LM.memoryAppendMessages(sessionId, messages)
  }

  async clearSession(sessionId: string): Promise<void> {
    this.check(Permission.MemoryWrite)
    return LM.memoryClearSession(sessionId)
  }

  // ── Read operations (Permission.MemoryRead) ───────────────────────────────

  async list(options?: {
    scope?: string
    type?: MemoryType
    limit?: number
  }): Promise<IMemoryEntry[]> {
    this.check(Permission.MemoryRead)
    const resolved = options?.scope !== undefined
      ? resolveScope(options.scope, this.moduleId)
      : undefined
    return LM.memoryList({
      ...(resolved !== undefined && { scope: resolved }),
      ...(options?.type !== undefined && { memoryType: options.type }),
      ...(options?.limit !== undefined && { limit: options.limit }),
    })
  }

  async get(id: string): Promise<IMemoryEntry> {
    this.check(Permission.MemoryRead)
    return LM.memoryGet(id)
  }

  async buildContext(options?: { scope?: string; maxEntries?: number }): Promise<string> {
    this.check(Permission.MemoryRead)
    const resolved = options?.scope !== undefined
      ? resolveScope(options.scope, this.moduleId)
      : `bot:${this.moduleId}`
    const buildOpts: { scope?: string; maxEntries?: number } = { scope: resolved }
    if (options?.maxEntries !== undefined) buildOpts.maxEntries = options.maxEntries
    return LM.memoryBuildContext(buildOpts)
  }

  async stats(): Promise<IMemoryStats> {
    this.check(Permission.MemoryRead)
    return LM.memoryStats()
  }

  async getHistory(sessionId: string, limit?: number): Promise<IConversationMessage[]> {
    this.check(Permission.MemoryRead)
    return LM.memoryGetHistory(sessionId, limit)
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private check(permission: Permission): void {
    this.permissionEngine.check(this.moduleId, permission)
  }
}

