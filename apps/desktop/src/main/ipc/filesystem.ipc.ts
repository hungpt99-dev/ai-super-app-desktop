/**
 * Filesystem IPC Handler — generic filesystem operations for the renderer.
 *
 * Channels:
 * - filesystem:read    → read JSON from storage
 * - filesystem:write   → write JSON to storage
 * - filesystem:delete  → delete a file from storage
 * - filesystem:list    → list files in a subdirectory
 *
 * All operations delegate to IFileStoragePort (TauriFileStorageAdapter).
 * No node:fs. No Node built-ins.
 */

import type { IFileStoragePort } from '@agenthub/contracts'
import { TauriFileStorageAdapter } from '../../bridges/tauri-file-storage.js'
import { logger } from '@agenthub/shared'

const log = logger.child('FilesystemIPC')

export interface IFilesystemReadPayload {
    readonly subdir: string
    readonly filename: string
}

export interface IFilesystemWritePayload {
    readonly subdir: string
    readonly filename: string
    readonly data: unknown
}

export interface IFilesystemDeletePayload {
    readonly subdir: string
    readonly filename: string
}

export interface IFilesystemListPayload {
    readonly subdir: string
}

export class FilesystemIPCHandler {
    private storage: IFileStoragePort

    constructor(storage?: IFileStoragePort) {
        this.storage = storage ?? new TauriFileStorageAdapter()
    }

    setStorage(storage: IFileStoragePort): void {
        this.storage = storage
    }

    async read(payload: IFilesystemReadPayload): Promise<unknown> {
        log.info('filesystem:read', { subdir: payload.subdir, filename: payload.filename })
        return this.storage.readJson(payload.subdir, payload.filename)
    }

    async write(payload: IFilesystemWritePayload): Promise<void> {
        log.info('filesystem:write', { subdir: payload.subdir, filename: payload.filename })
        await this.storage.writeJson(payload.subdir, payload.filename, payload.data)
    }

    async delete(payload: IFilesystemDeletePayload): Promise<void> {
        log.info('filesystem:delete', { subdir: payload.subdir, filename: payload.filename })
        await this.storage.deleteFile(payload.subdir, payload.filename)
    }

    async list(payload: IFilesystemListPayload): Promise<readonly string[]> {
        log.info('filesystem:list', { subdir: payload.subdir })
        return this.storage.listFiles(payload.subdir)
    }
}

export const filesystemIPC = new FilesystemIPCHandler()
