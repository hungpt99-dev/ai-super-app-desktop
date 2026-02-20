/**
 * sandboxed-memory.ts
 *
 * Permission-enforced proxy around all local-memory operations.
 * Modules receive this instance as `ctx.memory`.
 *
 * Permission mapping:
 * - upsert, delete, appendMessages, clearSession → Permission.MemoryWrite
 * - list, get, buildContext, stats, getHistory   → Permission.MemoryRead
 */

import type {
  IConversationMessage,
  IMemoryAPI,
  IMemoryEntry,
  IMemoryStats,
  IMemoryUpsertInput,
  MemoryType,
} from '@ai-super-app/sdk'
import { Permission } from '@ai-super-app/sdk'
import type { PermissionEngine } from '../core/permission-engine.js'
import * as LM from './local-memory.js'

export class SandboxedMemory implements IMemoryAPI {
  constructor(
    private readonly moduleId: string,
    private readonly permissionEngine: PermissionEngine,
  ) {}

  // ── Write operations (Permission.MemoryWrite) ─────────────────────────────

  async upsert(input: IMemoryUpsertInput): Promise<IMemoryEntry> {
    this.check(Permission.MemoryWrite)
    return LM.memoryUpsert(input)
  }

  async delete(id: string): Promise<void> {
    this.check(Permission.MemoryWrite)
    return LM.memoryDelete(id)
  }

  async appendMessages(
    sessionId: string,
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
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
    return LM.memoryList({
      ...(options?.scope !== undefined && { scope: options.scope }),
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
    return LM.memoryBuildContext(options)
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
