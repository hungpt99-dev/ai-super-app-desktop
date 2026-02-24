/**
 * PluginLoaderAdapter — loads plugin manifests from the filesystem.
 *
 * Scans ~/.agenthub/plugins/ for plugin directories with manifest.json.
 */

import type { PluginDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

const log = logger.child('PluginLoaderAdapter')

type IPluginManifest = PluginDomain.IPluginManifest

export class PluginLoaderAdapter {
    private readonly pluginsDir: string

    constructor(pluginsDir: string) {
        this.pluginsDir = pluginsDir
    }

    getPluginsDir(): string {
        return this.pluginsDir
    }

    parseManifest(raw: unknown): IPluginManifest | null {
        if (typeof raw !== 'object' || raw === null) {
            log.warn('Invalid plugin manifest: not an object')
            return null
        }

        const obj = raw as Record<string, unknown>

        if (typeof obj['id'] !== 'string' || typeof obj['name'] !== 'string' ||
            typeof obj['version'] !== 'string' || typeof obj['entryPoint'] !== 'string') {
            log.warn('Invalid plugin manifest: missing required fields')
            return null
        }

        return {
            id: obj['id'] as string,
            name: obj['name'] as string,
            version: obj['version'] as string,
            description: (obj['description'] as string) ?? '',
            author: obj['author'] as string | undefined,
            entryPoint: obj['entryPoint'] as string,
            permissions: Array.isArray(obj['permissions']) ? obj['permissions'] as string[] : [],
            minCoreVersion: (obj['minCoreVersion'] as string) ?? '1.0.0',
            maxCoreVersion: (obj['maxCoreVersion'] as string) ?? '99.0.0',
        }
    }
}
