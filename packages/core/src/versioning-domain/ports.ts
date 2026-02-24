/**
 * VersioningPort — port interface for semantic version management.
 *
 * Implementations live in infrastructure (e.g. SemanticVersioningAdapter).
 * Core defines only the contract.
 */

import type { VersionBump, IVersionRecord, IVersionHistory } from './types.js'

export interface IVersioningPort {
    /** Increment version, persist record, return new version string. */
    bump(entityId: string, entityType: 'agent' | 'skill', bump: VersionBump, metadata?: Record<string, unknown>): Promise<string>
    /** Get current version string for an entity. Returns null if unversioned. */
    getCurrentVersion(entityId: string): Promise<string | null>
    /** Get full version history for an entity. */
    getHistory(entityId: string): Promise<IVersionHistory | null>
    /** Get a specific version record. */
    getVersion(entityId: string, version: string): Promise<IVersionRecord | null>
    /** Delete all version records for an entity. */
    deleteHistory(entityId: string): Promise<void>
}
