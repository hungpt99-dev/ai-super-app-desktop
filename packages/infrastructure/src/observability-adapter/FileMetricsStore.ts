/**
 * FileMetricsStore — file-based persistence for token/tool usage metrics.
 *
 * Storage layout:
 *   ~/.agenthub/metrics/daily/YYYY-MM-DD.json
 *   ~/.agenthub/metrics/executions/executionId.json
 *
 * Requirements:
 * - Append-safe
 * - Atomic write (write to temp then rename)
 * - No corruption
 * - Async only
 * - No blocking event loop
 */

import { join } from 'node:path'
import { homedir } from 'node:os'
import {
    readFile,
    writeFile,
    mkdir,
    readdir,
    rename,
} from 'node:fs/promises'
import type {
    IMetricsStore,
    TokenUsageRecord,
    ToolUsageRecord,
} from '@agenthub/observability'

interface ExecutionFile {
    readonly tokens: TokenUsageRecord[]
    readonly tools: ToolUsageRecord[]
}

interface DailyFile {
    readonly tokens: TokenUsageRecord[]
    readonly tools: ToolUsageRecord[]
}

function getMetricsDir(): string {
    return join(homedir(), '.agenthub', 'metrics')
}

function getDailyDir(): string {
    return join(getMetricsDir(), 'daily')
}

function getExecutionsDir(): string {
    return join(getMetricsDir(), 'executions')
}

function formatDate(timestamp: number): string {
    const d = new Date(timestamp)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

async function ensureDir(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true })
}

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
    try {
        const content = await readFile(path, 'utf-8')
        return JSON.parse(content) as T
    } catch {
        return fallback
    }
}

async function atomicWriteJson(path: string, data: unknown): Promise<void> {
    const tmpPath = `${path}.tmp.${Date.now()}`
    const content = JSON.stringify(data, null, 2)
    await writeFile(tmpPath, content, 'utf-8')
    await rename(tmpPath, path)
}

export class FileMetricsStore implements IMetricsStore {
    async appendTokenUsage(record: TokenUsageRecord): Promise<void> {
        await this.appendToExecution(record.executionId, 'tokens', record)
        await this.appendToDaily(record.timestamp, 'tokens', record)
    }

    async appendToolUsage(record: ToolUsageRecord): Promise<void> {
        await this.appendToExecution(record.executionId, 'tools', record)
        await this.appendToDaily(record.timestamp, 'tools', record)
    }

    async getTokenRecords(executionId: string): Promise<readonly TokenUsageRecord[]> {
        const data = await this.readExecutionFile(executionId)
        return data.tokens
    }

    async getToolRecords(executionId: string): Promise<readonly ToolUsageRecord[]> {
        const data = await this.readExecutionFile(executionId)
        return data.tools
    }

    async getDailyTokenRecords(date: string): Promise<readonly TokenUsageRecord[]> {
        const data = await this.readDailyFile(date)
        return data.tokens
    }

    async getDailyToolRecords(date: string): Promise<readonly ToolUsageRecord[]> {
        const data = await this.readDailyFile(date)
        return data.tools
    }

    async getAllExecutionIds(): Promise<readonly string[]> {
        const dir = getExecutionsDir()
        await ensureDir(dir)
        try {
            const files = await readdir(dir)
            return files
                .filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
                .map((f) => f.replace('.json', ''))
                .sort()
        } catch {
            return []
        }
    }

    async getExecutionRecords(executionId: string): Promise<{
        readonly tokens: readonly TokenUsageRecord[]
        readonly tools: readonly ToolUsageRecord[]
    }> {
        return this.readExecutionFile(executionId)
    }

    private async appendToExecution(executionId: string, key: 'tokens' | 'tools', record: TokenUsageRecord | ToolUsageRecord): Promise<void> {
        const dir = getExecutionsDir()
        await ensureDir(dir)
        const filePath = join(dir, `${executionId}.json`)
        const data = await readJsonFile<ExecutionFile>(filePath, { tokens: [], tools: [] })
        const mutable = { tokens: [...data.tokens], tools: [...data.tools] }
        if (key === 'tokens') {
            mutable.tokens.push(record as TokenUsageRecord)
        } else {
            mutable.tools.push(record as ToolUsageRecord)
        }
        await atomicWriteJson(filePath, mutable)
    }

    private async appendToDaily(timestamp: number, key: 'tokens' | 'tools', record: TokenUsageRecord | ToolUsageRecord): Promise<void> {
        const date = formatDate(timestamp)
        const dir = getDailyDir()
        await ensureDir(dir)
        const filePath = join(dir, `${date}.json`)
        const data = await readJsonFile<DailyFile>(filePath, { tokens: [], tools: [] })
        const mutable = { tokens: [...data.tokens], tools: [...data.tools] }
        if (key === 'tokens') {
            mutable.tokens.push(record as TokenUsageRecord)
        } else {
            mutable.tools.push(record as ToolUsageRecord)
        }
        await atomicWriteJson(filePath, mutable)
    }

    private async readExecutionFile(executionId: string): Promise<ExecutionFile> {
        const dir = getExecutionsDir()
        await ensureDir(dir)
        return readJsonFile<ExecutionFile>(join(dir, `${executionId}.json`), { tokens: [], tools: [] })
    }

    private async readDailyFile(date: string): Promise<DailyFile> {
        const dir = getDailyDir()
        await ensureDir(dir)
        return readJsonFile<DailyFile>(join(dir, `${date}.json`), { tokens: [], tools: [] })
    }
}
