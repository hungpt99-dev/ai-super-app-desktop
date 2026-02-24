/**
 * Sandbox interfaces — isolation boundaries for module execution.
 *
 * See: docs/codebase.md Sandbox Rule
 * See: docs/technical-design.md §10 SECURITY ARCHITECTURE
 */

import type { Permission } from '@agenthub/shared'

// ─── Permission Guard ───────────────────────────────────────────────────────

/**
 * Permission guard interface. The sandbox checks permissions before
 * every privileged operation.
 */
export interface IPermissionGuard {
    /** Check if a module has a specific permission. Throws if denied. */
    check(moduleId: string, permission: Permission): void
    /** Non-throwing permission check. */
    hasPermission(moduleId: string, permission: Permission): boolean
}

// ─── Sandbox ────────────────────────────────────────────────────────────────

export type SandboxStatus = 'created' | 'active' | 'suspended' | 'destroyed'

export interface ISandbox {
    readonly moduleId: string
    readonly status: SandboxStatus
    /** Activate the sandbox — initialise the module context. */
    activate(): Promise<void>
    /** Deactivate the sandbox — tear down the module context. */
    deactivate(): Promise<void>
    /** Destroy the sandbox — release all resources. */
    destroy(): Promise<void>
}

// ─── Resource Limits ────────────────────────────────────────────────────────

export interface ISandboxResourceLimits {
    /** Maximum memory in bytes. */
    readonly maxMemoryBytes?: number
    /** Maximum execution time in milliseconds. */
    readonly maxExecutionMs?: number
    /** Maximum number of concurrent tool executions. */
    readonly maxConcurrentTools?: number
}

// ─── Worker Sandbox ─────────────────────────────────────────────────────────

export interface ISandboxConfig {
    timeoutMs: number
    maxMemoryMb: number
    disableNetwork: boolean
    disableFilesystem: boolean
}

export interface ISandboxResult {
    output: unknown
    executionTimeMs: number
    error?: Error
}

export interface IWorkerSandbox {
    execute(code: string, args: Record<string, unknown>, config: ISandboxConfig): Promise<ISandboxResult>
    terminate(): Promise<void>
}

export interface ICoreSandboxPort {
    execute(code: string, context: Record<string, unknown>): Promise<unknown>
    destroy(): Promise<void>
}
