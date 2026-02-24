/**
 * DesktopPlanningClient — typed SDK wrapper for planning IPC.
 *
 * Renderer code must use this client instead of importing PlanningEngine directly.
 * All operations go through the IPC bridge.
 */

import type {
    IIPCRequest,
    IIPCResponse,
    IPlanningCreatePayload,
    IPlanningCreateResult,
    IPlanningMicroPayload,
    IPlanningMicroResult,
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
            throw new Error(response.error?.message ?? 'Planning IPC call failed')
        }
        return response.data as TResult
    } catch {
        const { handleIPCMessage } = await import('../../main/ipc/handler.js')
        const response = await handleIPCMessage(request as any)
        if (!response.success) {
            throw new Error(response.error?.message ?? 'Planning IPC call failed')
        }
        return response.data as TResult
    }
}

export class DesktopPlanningClient {
    async create(payload: IPlanningCreatePayload): Promise<IPlanningCreateResult> {
        return ipcInvoke<IPlanningCreatePayload, IPlanningCreateResult>('planning:create', payload)
    }

    async micro(payload: IPlanningMicroPayload): Promise<IPlanningMicroResult> {
        return ipcInvoke<IPlanningMicroPayload, IPlanningMicroResult>('planning:micro', payload)
    }
}

let _client: DesktopPlanningClient | null = null

export function getPlanningClient(): DesktopPlanningClient {
    if (!_client) _client = new DesktopPlanningClient()
    return _client
}
