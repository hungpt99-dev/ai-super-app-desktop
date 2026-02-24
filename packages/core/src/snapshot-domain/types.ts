/**
 * Snapshot domain types — data shapes for execution snapshot persistence.
 *
 * Core domain only. No adapters, no filesystem logic.
 */

export interface ISnapshotRecord {
    readonly executionId: string
    readonly agentId: string
    readonly agentState: unknown
    readonly graphState: unknown
    readonly memoryState: unknown
    readonly executionState: unknown
    readonly eventLogRef: string
    readonly version: string
    readonly createdAt: string
}

export interface ISnapshotSummary {
    readonly executionId: string
    readonly agentId: string
    readonly version: string
    readonly createdAt: string
}
