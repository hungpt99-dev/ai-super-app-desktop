/**
 * Snapshot DTOs — serializable data for execution persistence & replay.
 *
 * Snapshots capture the full execution state at a given point in time,
 * enabling pause/resume and deterministic replay.
 *
 * See: docs/technical-design.md §8 SNAPSHOT & REPLAY SYSTEM
 */

// ─── Snapshot Data ──────────────────────────────────────────────────────────

export interface ISnapshotDTO {
    readonly executionId: string
    readonly agentId: string
    readonly nodePointer: string
    readonly variables: Record<string, unknown>
    readonly memoryReferences: readonly string[]
    readonly callStack: readonly string[]
    readonly providerRawResponse?: Record<string, unknown>
    readonly timestamp: string
}

// ─── Snapshot Summary ───────────────────────────────────────────────────────

export interface ISnapshotSummaryDTO {
    readonly executionId: string
    readonly agentId: string
    readonly nodePointer: string
    readonly timestamp: string
    readonly snapshotCount: number
}

// ─── Replay Request ─────────────────────────────────────────────────────────

export interface IReplayRequestDTO {
    readonly executionId: string
    readonly fromNodePointer?: string
    readonly deterministic: boolean
}

// ─── Replay Result ──────────────────────────────────────────────────────────

export interface IReplayResultDTO {
    readonly executionId: string
    readonly originalExecutionId: string
    readonly status: 'completed' | 'failed' | 'diverged'
    readonly steps: number
    readonly divergencePoint?: string
    readonly timestamp: string
}
