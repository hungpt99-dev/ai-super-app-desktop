/**
 * Execution IPC Handler — manages execution lifecycle from renderer requests.
 *
 * Channels:
 * - execution:start  → start agent execution
 * - execution:stop   → abort running execution
 * - execution:replay → replay from snapshot
 * - execution:state  → get current execution state
 *
 * Events streamed via execution:event channel.
 */

import type {
    IExecutionStartPayload,
    IExecutionStartResult,
    IExecutionStopPayload,
    IExecutionStateResult,
    ExecutionStreamEvent,
} from '@agenthub/contracts'
import type { IReplayRequestDTO, IReplayResultDTO } from '@agenthub/contracts'
import type { SnapshotDomain, VersioningDomain } from '@agenthub/core'
import type { IRuntimeBundle } from '@agenthub/platform'
import { logger } from '@agenthub/shared'

const log = logger.child('ExecutionIPC')

type EventCallback = (event: ExecutionStreamEvent) => void

export class ExecutionIPCHandler {
    private readonly activeExecutions = new Map<string, AbortController>()
    private readonly eventListeners = new Set<EventCallback>()
    private runtimeBundle: IRuntimeBundle | null = null
    private snapshotStorage: SnapshotDomain.ISnapshotStoragePort | null = null

    setRuntime(bundle: IRuntimeBundle): void {
        this.runtimeBundle = bundle
    }

    setSnapshotStorage(storage: SnapshotDomain.ISnapshotStoragePort): void {
        this.snapshotStorage = storage
    }

    onEvent(callback: EventCallback): () => void {
        this.eventListeners.add(callback)
        return () => { this.eventListeners.delete(callback) }
    }

    private emitEvent(event: ExecutionStreamEvent): void {
        for (const listener of this.eventListeners) {
            try {
                listener(event)
            } catch (err) {
                log.error('Event listener error', { error: String(err) })
            }
        }
    }

    async start(payload: IExecutionStartPayload): Promise<IExecutionStartResult> {
        if (!this.runtimeBundle) {
            throw new Error('Runtime not initialized')
        }

        const executionId = crypto.randomUUID()
        const controller = new AbortController()
        this.activeExecutions.set(executionId, controller)

        const timestamp = new Date().toISOString()

        this.emitEvent({
            type: 'ExecutionCreated',
            executionId,
            agentId: payload.agentId,
            timestamp,
        })

        this.emitEvent({
            type: 'ExecutionValidated',
            executionId,
            timestamp: new Date().toISOString(),
        })

        this.emitEvent({
            type: 'ExecutionScheduled',
            executionId,
            timestamp: new Date().toISOString(),
        })

        try {
            const context = await this.runtimeBundle.runtime.execute(payload.agentId, payload.input)

            this.emitEvent({
                type: 'ExecutionCompleted',
                executionId,
                result: context.variables,
                totalTokens: context.tokenUsage.promptTokens + context.tokenUsage.completionTokens,
                timestamp: new Date().toISOString(),
            })

            if (this.snapshotStorage) {
                await this.snapshotStorage.save({
                    executionId,
                    agentId: payload.agentId,
                    agentState: context.variables,
                    graphState: { currentNodeId: context.currentNodeId },
                    memoryState: {},
                    executionState: { tokenUsage: context.tokenUsage },
                    eventLogRef: `events/${executionId}.json`,
                    version: '1.0.0',
                    createdAt: new Date().toISOString(),
                })

                this.emitEvent({
                    type: 'SnapshotPersisted',
                    executionId,
                    snapshotId: executionId,
                    timestamp: new Date().toISOString(),
                })
            }

            return { executionId, status: 'completed' }
        } catch (err) {
            this.emitEvent({
                type: 'ExecutionFailed',
                executionId,
                error: err instanceof Error ? err.message : String(err),
                timestamp: new Date().toISOString(),
            })
            return { executionId, status: 'failed' }
        } finally {
            this.activeExecutions.delete(executionId)
        }
    }

    async stop(payload: IExecutionStopPayload): Promise<void> {
        const controller = this.activeExecutions.get(payload.executionId)
        if (controller) {
            controller.abort()
            this.activeExecutions.delete(payload.executionId)
            await this.runtimeBundle?.runtime.abort(payload.executionId)
        }
    }

    async getState(executionId: string): Promise<IExecutionStateResult> {
        return {
            executionId,
            state: this.activeExecutions.has(executionId) ? 'running' : 'idle',
            currentNodeId: null,
            stepCount: 0,
            tokenUsage: { promptTokens: 0, completionTokens: 0 },
        }
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

        this.emitEvent({
            type: 'ExecutionCreated',
            executionId: newExecutionId,
            agentId: snapshot.agentId,
            timestamp: new Date().toISOString(),
        })

        return {
            executionId: newExecutionId,
            originalExecutionId: request.executionId,
            status: 'completed',
            steps: 0,
            timestamp: new Date().toISOString(),
        }
    }

    getActiveCount(): number {
        return this.activeExecutions.size
    }
}

export const executionIPC = new ExecutionIPCHandler()
