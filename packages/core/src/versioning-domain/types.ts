/**
 * Versioning domain types — semantic versioning data shapes.
 *
 * Core domain only. No adapters, no filesystem logic.
 */

export type VersionBump = 'patch' | 'minor' | 'major'

export interface IVersionRecord {
    readonly entityId: string
    readonly entityType: 'agent' | 'skill'
    readonly version: string
    readonly previousVersion: string | null
    readonly bump: VersionBump
    readonly migrationMetadata: Readonly<Record<string, unknown>>
    readonly createdAt: string
}

export interface IVersionHistory {
    readonly entityId: string
    readonly entityType: 'agent' | 'skill'
    readonly versions: readonly IVersionRecord[]
    readonly currentVersion: string
}
