/**
 * LocalSnapshotStorageAdapter — filesystem-based snapshot persistence.
 *
 * Implements ISnapshotStoragePort from core.
 * Stores snapshots at ~/.agenthub/snapshots/.
 *
 * Infrastructure layer only — core never imports this.
 */

import type { SnapshotDomain } from '@agenthub/core'
import { LocalFileStorageAdapter } from '../local-storage-adapter/index.js'

type ISnapshotStoragePort = SnapshotDomain.ISnapshotStoragePort
type ISnapshotRecord = SnapshotDomain.ISnapshotRecord
type ISnapshotSummary = SnapshotDomain.ISnapshotSummary

const SNAPSHOTS_DIR = 'snapshots'

export class LocalSnapshotStorageAdapter implements ISnapshotStoragePort {
    private readonly storage: LocalFileStorageAdapter

    constructor(storage?: LocalFileStorageAdapter) {
        this.storage = storage ?? new LocalFileStorageAdapter()
    }

    async save(snapshot: ISnapshotRecord): Promise<void> {
        const filename = `${snapshot.executionId}.json`
        await this.storage.writeJson(SNAPSHOTS_DIR, filename, snapshot)
    }

    async load(executionId: string): Promise<ISnapshotRecord | null> {
        return this.storage.readJson<ISnapshotRecord>(SNAPSHOTS_DIR, `${executionId}.json`)
    }

    async list(): Promise<readonly ISnapshotSummary[]> {
        const all = await this.storage.readAllJson<ISnapshotRecord>(SNAPSHOTS_DIR)
        return all.map(toSummary)
    }

    async listByAgent(agentId: string): Promise<readonly ISnapshotSummary[]> {
        const all = await this.storage.readAllJson<ISnapshotRecord>(SNAPSHOTS_DIR)
        return all.filter(s => s.agentId === agentId).map(toSummary)
    }

    async delete(executionId: string): Promise<void> {
        await this.storage.deleteFile(SNAPSHOTS_DIR, `${executionId}.json`)
    }

    async deleteAll(): Promise<void> {
        const files = await this.storage.listFiles(SNAPSHOTS_DIR)
        for (const file of files) {
            await this.storage.deleteFile(SNAPSHOTS_DIR, file)
        }
    }
}

function toSummary(record: ISnapshotRecord): ISnapshotSummary {
    return {
        executionId: record.executionId,
        agentId: record.agentId,
        version: record.version,
        createdAt: record.createdAt,
    }
}
