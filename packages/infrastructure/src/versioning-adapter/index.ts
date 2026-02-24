/**
 * SemanticVersioningAdapter — filesystem-based semantic versioning.
 *
 * Implements IVersioningPort from core.
 * Stores version records at ~/.agenthub/versions/.
 *
 * Rules:
 * - Increment patch on save
 * - Allow manual minor/major bump
 * - Preserve history folder
 * - Store migration metadata
 *
 * Infrastructure layer only — core never imports this.
 */

import type { VersioningDomain } from '@agenthub/core'
import type { IFileStoragePort } from '@agenthub/contracts'

type IVersioningPort = VersioningDomain.IVersioningPort
type VersionBump = VersioningDomain.VersionBump
type IVersionRecord = VersioningDomain.IVersionRecord
type IVersionHistory = VersioningDomain.IVersionHistory

const VERSIONS_DIR = 'versions'

export class SemanticVersioningAdapter implements IVersioningPort {
    private readonly storage: IFileStoragePort

    constructor(storage: IFileStoragePort) {
        this.storage = storage
    }

    async bump(
        entityId: string,
        entityType: 'agent' | 'skill',
        bump: VersionBump,
        metadata?: Record<string, unknown>,
    ): Promise<string> {
        const history = await this.loadHistory(entityId)
        const currentVersion = history?.currentVersion ?? '0.0.0'
        const newVersion = incrementVersion(currentVersion, bump)

        const record: IVersionRecord = {
            entityId,
            entityType,
            version: newVersion,
            previousVersion: currentVersion === '0.0.0' ? null : currentVersion,
            bump,
            migrationMetadata: metadata ?? {},
            createdAt: new Date().toISOString(),
        }

        const existingVersions = history?.versions ?? []
        const updatedHistory: IVersionHistory = {
            entityId,
            entityType,
            versions: [...existingVersions, record],
            currentVersion: newVersion,
        }

        await this.storage.writeJson(VERSIONS_DIR, `${entityId}.json`, updatedHistory)
        return newVersion
    }

    async getCurrentVersion(entityId: string): Promise<string | null> {
        const history = await this.loadHistory(entityId)
        return history?.currentVersion ?? null
    }

    async getHistory(entityId: string): Promise<IVersionHistory | null> {
        return this.loadHistory(entityId)
    }

    async getVersion(entityId: string, version: string): Promise<IVersionRecord | null> {
        const history = await this.loadHistory(entityId)
        if (!history) return null
        return history.versions.find(v => v.version === version) ?? null
    }

    async deleteHistory(entityId: string): Promise<void> {
        await this.storage.deleteFile(VERSIONS_DIR, `${entityId}.json`)
    }

    private async loadHistory(entityId: string): Promise<IVersionHistory | null> {
        return this.storage.readJson<IVersionHistory>(VERSIONS_DIR, `${entityId}.json`)
    }
}

function incrementVersion(version: string, bump: VersionBump): string {
    const parts = version.split('.').map(Number)
    const major = parts[0] ?? 0
    const minor = parts[1] ?? 0
    const patch = parts[2] ?? 0

    switch (bump) {
        case 'major':
            return `${major + 1}.0.0`
        case 'minor':
            return `${major}.${minor + 1}.0`
        case 'patch':
            return `${major}.${minor}.${patch + 1}`
    }
}
