/**
 * Sandbox interfaces — isolation boundaries for module execution.
 *
 * See: docs/codebase.md Sandbox Rule
 * See: docs/technical-design.md §10 SECURITY ARCHITECTURE
 */

import type { Permission } from '@agenthub/sdk'

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
