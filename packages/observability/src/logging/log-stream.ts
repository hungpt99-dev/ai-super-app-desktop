/**
 * StructuredLogStream — implements IStructuredLogStream from core.
 *
 * Provides structured log stream with subscription and query support.
 */

import type { ObservabilityDomain } from '@agenthub/core'

type IStructuredLogStream = ObservabilityDomain.IStructuredLogStream
type IStructuredLogEntry = ObservabilityDomain.IStructuredLogEntry
type StructuredLogLevel = ObservabilityDomain.StructuredLogLevel

export class LogStream implements IStructuredLogStream {
    private readonly entries: IStructuredLogEntry[] = []
    private readonly listeners: Set<(entry: IStructuredLogEntry) => void> = new Set()
    private readonly maxEntries: number

    constructor(maxEntries: number = 10_000) {
        this.maxEntries = maxEntries
    }

    write(entry: IStructuredLogEntry): void {
        this.entries.push(entry)

        if (this.entries.length > this.maxEntries) {
            this.entries.splice(0, this.entries.length - this.maxEntries)
        }

        for (const listener of this.listeners) {
            try {
                listener(entry)
            } catch {
                // Listener errors should not break the log stream
            }
        }
    }

    subscribe(listener: (entry: IStructuredLogEntry) => void): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    query(filter: {
        level?: StructuredLogLevel
        context?: string
        traceId?: string
        executionId?: string
        limit?: number
    }): readonly IStructuredLogEntry[] {
        let results = [...this.entries]

        if (filter.level) {
            results = results.filter(e => e.level === filter.level)
        }
        if (filter.context) {
            results = results.filter(e => e.context === filter.context)
        }
        if (filter.traceId) {
            results = results.filter(e => e.traceId === filter.traceId)
        }
        if (filter.executionId) {
            results = results.filter(e => e.executionId === filter.executionId)
        }

        if (filter.limit) {
            results = results.slice(-filter.limit)
        }

        return results
    }

    clear(): void {
        this.entries.length = 0
    }

    size(): number {
        return this.entries.length
    }
}
