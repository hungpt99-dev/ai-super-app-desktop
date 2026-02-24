/**
 * Skill DTOs — serializable data transfer objects for skills/tools.
 *
 * Skills are the user-facing abstraction for agent capabilities.
 * These DTOs are used for IPC, marketplace listing, and UI rendering.
 *
 * See: docs/technical-design.md §6 TOOL SYSTEM
 */

// ─── Skill Definition DTO ───────────────────────────────────────────────────

export interface ISkillDTO {
    readonly name: string
    readonly description: string
    readonly category: string
    readonly inputSchema: Record<string, unknown>
    readonly timeoutMs: number
    readonly version: string
    readonly author?: string
}

// ─── Skill Execution Result DTO ─────────────────────────────────────────────

export interface ISkillResultDTO {
    readonly skillName: string
    readonly success: boolean
    readonly output: unknown
    readonly error?: string
    readonly durationMs: number
    readonly executionId: string
    readonly timestamp: string
}

// ─── Skill Registry Entry DTO ───────────────────────────────────────────────

export interface ISkillRegistryEntryDTO {
    readonly name: string
    readonly description: string
    readonly category: string
    readonly isBuiltin: boolean
    readonly moduleId: string
    readonly inputSchema: Record<string, unknown>
}

// ─── Module Skill Manifest ──────────────────────────────────────────────────

export interface IModuleSkillManifestDTO {
    readonly moduleId: string
    readonly moduleName: string
    readonly moduleVersion: string
    readonly skills: readonly ISkillDTO[]
}
