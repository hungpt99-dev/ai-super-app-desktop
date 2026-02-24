/**
 * SnapshotStoragePort — port interface for snapshot persistence.
 *
 * Implementations live in infrastructure (e.g. LocalSnapshotStorageAdapter).
 * Core defines only the contract.
 */

import type { ISnapshotRecord, ISnapshotSummary } from './types.js'

export interface ISnapshotStoragePort {
    save(snapshot: ISnapshotRecord): Promise<void>
    load(executionId: string): Promise<ISnapshotRecord | null>
    list(): Promise<readonly ISnapshotSummary[]>
    listByAgent(agentId: string): Promise<readonly ISnapshotSummary[]>
    delete(executionId: string): Promise<void>
    deleteAll(): Promise<void>
}
