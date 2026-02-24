/**
 * DesktopRuntimeClient — SDK layer for execution playground.
 *
 * Wraps IPC calls to the main process.
 * Must not instantiate runtime.
 * Must not import execution or core.
 *
 * Renderer imports this via @agenthub/sdk.
 */

import type {
    IExecutionStartPayload,
    IExecutionStartResult,
    IExecutionStopPayload,
    IExecutionStateResult,
    ExecutionStreamEvent,
    IReplayRequestDTO,
    IReplayResultDTO,
} from '@agenthub/contracts'

export interface IDesktopRuntimeClient {
    startExecution(agentId: string, input: Record<string, unknown>): Promise<IExecutionStartResult>
    stopExecution(executionId: string): Promise<void>
    replayExecution(request: IReplayRequestDTO): Promise<IReplayResultDTO>
    getExecutionState(executionId: string): Promise<IExecutionStateResult>
    onExecutionEvent(handler: (event: ExecutionStreamEvent) => void): () => void
}

export class DesktopRuntimeClient implements IDesktopRuntimeClient {
    private getBridge(): NonNullable<typeof window.agenthubDesktop> {
        if (!window.agenthubDesktop) {
            throw new Error('Desktop bridge not initialized. Ensure getDesktopExtendedBridge() was called.')
        }
        return window.agenthubDesktop
    }

    async startExecution(agentId: string, input: Record<string, unknown>): Promise<IExecutionStartResult> {
        const payload: IExecutionStartPayload = { agentId, input }
        return this.getBridge().execution.start(payload)
    }

    async stopExecution(executionId: string): Promise<void> {
        const payload: IExecutionStopPayload = { executionId }
        return this.getBridge().execution.stop(payload)
    }

    async replayExecution(request: IReplayRequestDTO): Promise<IReplayResultDTO> {
        return this.getBridge().execution.replay(request)
    }

    async getExecutionState(executionId: string): Promise<IExecutionStateResult> {
        return this.getBridge().execution.getState(executionId)
    }

    onExecutionEvent(handler: (event: ExecutionStreamEvent) => void): () => void {
        return this.getBridge().execution.onEvent(handler)
    }
}
