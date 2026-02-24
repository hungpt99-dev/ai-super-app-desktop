/**
 * DesktopSnapshotClient — SDK layer for snapshot management.
 *
 * Wraps IPC calls to the main process.
 * Must not instantiate runtime.
 * Must not import execution or core.
 *
 * Renderer imports this via @agenthub/sdk.
 */

import type {
    ISnapshotSummaryDTO,
    ISnapshotDTO,
    IReplayRequestDTO,
    IReplayResultDTO,
} from '@agenthub/contracts'

export interface IDesktopSnapshotClient {
    listSnapshots(): Promise<readonly ISnapshotSummaryDTO[]>
    loadSnapshot(executionId: string): Promise<ISnapshotDTO | null>
    deleteSnapshot(executionId: string): Promise<void>
    replaySnapshot(request: IReplayRequestDTO): Promise<IReplayResultDTO>
}

export class DesktopSnapshotClient implements IDesktopSnapshotClient {
    private getBridge(): NonNullable<typeof window.agenthubDesktop> {
        if (!window.agenthubDesktop) {
            throw new Error('Desktop bridge not initialized. Ensure getDesktopExtendedBridge() was called.')
        }
        return window.agenthubDesktop
    }

    async listSnapshots(): Promise<readonly ISnapshotSummaryDTO[]> {
        return this.getBridge().snapshot.list()
    }

    async loadSnapshot(executionId: string): Promise<ISnapshotDTO | null> {
        return this.getBridge().snapshot.load(executionId)
    }

    async deleteSnapshot(executionId: string): Promise<void> {
        return this.getBridge().snapshot.delete(executionId)
    }

    async replaySnapshot(request: IReplayRequestDTO): Promise<IReplayResultDTO> {
        return this.getBridge().snapshot.replay(request)
    }
}
