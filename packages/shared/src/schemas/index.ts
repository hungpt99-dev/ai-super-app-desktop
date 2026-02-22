/**
 * Schemas — runtime validation schemas.
 *
 * Used for validating data at system boundaries: API inputs,
 * module manifests, snapshot JSON, etc.
 *
 * Convention: suffix every schema with `Schema`.
 * See: docs/codebase.md Naming Convention
 */

// ── Module Manifest Schema ──────────────────────────────────────────────────

/** Validate a module manifest at install time. */
export interface IManifestSchema {
    readonly name: string
    readonly version: string
    readonly minCoreVersion: string
    readonly maxCoreVersion: string
    readonly permissions: readonly string[]
}

/** Validate that a manifest has all required fields. */
export function validateManifest(raw: unknown): raw is IManifestSchema {
    if (typeof raw !== 'object' || raw === null) return false
    const obj = raw as Record<string, unknown>
    return (
        typeof obj['name'] === 'string' &&
        typeof obj['version'] === 'string' &&
        typeof obj['minCoreVersion'] === 'string' &&
        typeof obj['maxCoreVersion'] === 'string' &&
        Array.isArray(obj['permissions'])
    )
}

// ── Snapshot Schema ─────────────────────────────────────────────────────────

/** Validate a snapshot JSON payload (used by apps/web viewer). */
export function validateSnapshot(raw: unknown): boolean {
    if (typeof raw !== 'object' || raw === null) return false
    const obj = raw as Record<string, unknown>
    return (
        typeof obj['executionId'] === 'string' &&
        typeof obj['graphId'] === 'string' &&
        typeof obj['timestamp'] === 'string'
    )
}
