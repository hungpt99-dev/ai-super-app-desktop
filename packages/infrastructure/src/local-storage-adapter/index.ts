/**
 * LocalFileStorageAdapter — filesystem-based storage for agent/skill definitions.
 *
 * Stores JSON files at a configurable base path (default: ~/.agenthub/).
 * Infrastructure layer only — core never imports this.
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

export class LocalFileStorageAdapter {
    private readonly basePath: string

    constructor(basePath?: string) {
        this.basePath = basePath ?? path.join(os.homedir(), '.agenthub')
    }

    async ensureDir(subdir: string): Promise<string> {
        const dir = path.join(this.basePath, subdir)
        await fs.mkdir(dir, { recursive: true })
        return dir
    }

    async writeJson<T>(subdir: string, filename: string, data: T): Promise<void> {
        const dir = await this.ensureDir(subdir)
        const filePath = path.join(dir, filename)
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
    }

    async readJson<T>(subdir: string, filename: string): Promise<T | null> {
        const filePath = path.join(this.basePath, subdir, filename)
        try {
            const content = await fs.readFile(filePath, 'utf-8')
            return JSON.parse(content) as T
        } catch {
            return null
        }
    }

    async deleteFile(subdir: string, filename: string): Promise<void> {
        const filePath = path.join(this.basePath, subdir, filename)
        try {
            await fs.unlink(filePath)
        } catch {
            // File may not exist
        }
    }

    async listFiles(subdir: string): Promise<string[]> {
        const dir = path.join(this.basePath, subdir)
        try {
            const entries = await fs.readdir(dir)
            return entries.filter(e => e.endsWith('.json'))
        } catch {
            return []
        }
    }

    async readAllJson<T>(subdir: string): Promise<T[]> {
        const files = await this.listFiles(subdir)
        const results: T[] = []
        for (const file of files) {
            const data = await this.readJson<T>(subdir, file)
            if (data !== null) {
                results.push(data)
            }
        }
        return results
    }

    async copyToVersionDir(subdir: string, filename: string, version: string): Promise<void> {
        const src = path.join(this.basePath, subdir, filename)
        const versionDir = path.join(this.basePath, subdir, 'versions')
        await fs.mkdir(versionDir, { recursive: true })
        const base = path.parse(filename).name
        const dest = path.join(versionDir, `${base}_v${version}.json`)
        try {
            await fs.copyFile(src, dest)
        } catch {
            // Source may not exist yet
        }
    }
}
