/**
 * DesktopActingClient — typed SDK wrapper for acting IPC.
 *
 * Renderer code must use this client instead of importing ActingEngine directly.
 * All operations go through the IPC bridge.
 */

import type {
    IIPCRequest,
    IIPCResponse,
    IActingExecuteStepPayload,
    IActingExecuteStepResult,
    IActingExecuteMicroPayload,
    IActingExecuteMicroResult,
} from '@agenthub/contracts'

async function ipcInvoke<TPayload, TResult>(channel: string, payload: TPayload): Promise<TResult> {
    const request: IIPCRequest<TPayload> = {
        channel: channel as IIPCRequest['channel'],
        requestId: crypto.randomUUID(),
        payload,
        timestamp: new Date().toISOString(),
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core')
        const response = await invoke<IIPCResponse<TResult>>('handle_ipc', { request: JSON.stringify(request) })
        if (!response.success) {
            throw new Error(response.error?.message ?? 'Acting IPC call failed')
        }
        return response.data as TResult
    } catch {
        const { handleIPCMessage } = await import('../../main/ipc/handler.js')
        const response = await handleIPCMessage(request as any)
        if (!response.success) {
            throw new Error(response.error?.message ?? 'Acting IPC call failed')
        }
        return response.data as TResult
    }
}

export class DesktopActingClient {
    async executeStep(payload: IActingExecuteStepPayload): Promise<IActingExecuteStepResult> {
        return ipcInvoke<IActingExecuteStepPayload, IActingExecuteStepResult>('acting:executeStep', payload)
    }

    async executeMicro(payload: IActingExecuteMicroPayload): Promise<IActingExecuteMicroResult> {
        return ipcInvoke<IActingExecuteMicroPayload, IActingExecuteMicroResult>('acting:executeMicro', payload)
    }
}

let _client: DesktopActingClient | null = null

export function getActingClient(): DesktopActingClient {
    if (!_client) _client = new DesktopActingClient()
    return _client
}
