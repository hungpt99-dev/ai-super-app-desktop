/**
 * DesktopFilesystemClient — typed SDK wrapper for filesystem IPC.
 *
 * Renderer code must use this client instead of importing node:fs
 * or any Node built-in. All operations go through the IPC bridge.
 */

import type { IIPCRequest, IIPCResponse } from '@agenthub/contracts'
import type {
    IFilesystemReadPayload,
    IFilesystemWritePayload,
    IFilesystemDeletePayload,
    IFilesystemListPayload,
} from '../../main/ipc/filesystem.ipc.js'

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
            throw new Error(response.error?.message ?? 'Filesystem IPC call failed')
        }
        return response.data as TResult
    } catch {
        const { handleIPCMessage } = await import('../../main/ipc/handler.js')
        const response = await handleIPCMessage(request as any)
        if (!response.success) {
            throw new Error(response.error?.message ?? 'Filesystem IPC call failed')
        }
        return response.data as TResult
    }
}

export class DesktopFilesystemClient {
    async read<T = unknown>(subdir: string, filename: string): Promise<T | null> {
        const payload: IFilesystemReadPayload = { subdir, filename }
        return ipcInvoke<IFilesystemReadPayload, T | null>('filesystem:read', payload)
    }

    async write<T = unknown>(subdir: string, filename: string, data: T): Promise<void> {
        const payload: IFilesystemWritePayload = { subdir, filename, data }
        await ipcInvoke<IFilesystemWritePayload, void>('filesystem:write', payload)
    }

    async delete(subdir: string, filename: string): Promise<void> {
        const payload: IFilesystemDeletePayload = { subdir, filename }
        await ipcInvoke<IFilesystemDeletePayload, void>('filesystem:delete', payload)
    }

    async list(subdir: string): Promise<readonly string[]> {
        const payload: IFilesystemListPayload = { subdir }
        return ipcInvoke<IFilesystemListPayload, readonly string[]>('filesystem:list', payload)
    }
}

let _client: DesktopFilesystemClient | null = null

export function getFilesystemClient(): DesktopFilesystemClient {
    if (!_client) _client = new DesktopFilesystemClient()
    return _client
}
