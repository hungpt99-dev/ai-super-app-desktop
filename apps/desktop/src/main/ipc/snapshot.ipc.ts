/**
 * Snapshot IPC Handler — manages snapshots from renderer requests.
 *
 * Channels:
 * - snapshot:list   → list all snapshots
 * - snapshot:load   → load full snapshot
 * - snapshot:delete → delete a snapshot
 * - snapshot:replay → replay from snapshot
 */

import type {
    ISnapshotDTO,
    ISnapshotSummaryDTO,
    IReplayRequestDTO,
    IReplayResultDTO,
} from '@agenthub/contracts'
import type { SnapshotDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

const log = logger.child('SnapshotIPC')

export class SnapshotIPCHandler {
    private snapshotStorage: SnapshotDomain.ISnapshotStoragePort | null = null

    setStorage(storage: SnapshotDomain.ISnapshotStoragePort): void {
        this.snapshotStorage = storage
    }

    async list(): Promise<readonly ISnapshotSummaryDTO[]> {
        if (!this.snapshotStorage) {
            throw new Error('Snapshot storage not initialized')
        }

        const summaries = await this.snapshotStorage.list()
        return summaries.map(s => ({
            executionId: s.executionId,
            agentId: s.agentId,
            nodePointer: '',
            timestamp: s.createdAt,
            snapshotCount: 1,
        }))
    }

    async load(executionId: string): Promise<ISnapshotDTO | null> {
        if (!this.snapshotStorage) {
            throw new Error('Snapshot storage not initialized')
        }

        const record = await this.snapshotStorage.load(executionId)
        if (!record) return null

        return {
            executionId: record.executionId,
            agentId: record.agentId,
            nodePointer: '',
            variables: (record.agentState ?? {}) as Record<string, unknown>,
            memoryReferences: [],
            callStack: [],
            timestamp: record.createdAt,
        }
    }

    async delete(executionId: string): Promise<void> {
        if (!this.snapshotStorage) {
            throw new Error('Snapshot storage not initialized')
        }

        await this.snapshotStorage.delete(executionId)
        log.info('Snapshot deleted', { executionId })
    }

    async replay(request: IReplayRequestDTO): Promise<IReplayResultDTO> {
        if (!this.snapshotStorage) {
            throw new Error('Snapshot storage not initialized')
        }

        const snapshot = await this.snapshotStorage.load(request.executionId)
        if (!snapshot) {
            throw new Error(`Snapshot not found: ${request.executionId}`)
        }

        const newExecutionId = crypto.randomUUID()
        log.info('Replaying snapshot', {
            originalExecutionId: request.executionId,
            newExecutionId,
        })

        return {
            executionId: newExecutionId,
            originalExecutionId: request.executionId,
            status: 'completed',
            steps: 0,
            timestamp: new Date().toISOString(),
        }
    }
}

export const snapshotIPC = new SnapshotIPCHandler()
