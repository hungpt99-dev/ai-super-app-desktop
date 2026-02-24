/**
 * RateLimiter — enforces per-agent rate limits using sliding window counters.
 *
 * Implements IRateLimiterPort from core.
 */

import type { GovernanceDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type IRateLimiterPort = GovernanceDomain.IRateLimiterPort
type IRateLimitConfig = GovernanceDomain.IRateLimitConfig
type IRateLimitCheckResult = GovernanceDomain.IRateLimitCheckResult

const log = logger.child('RateLimiter')

const DEFAULT_CONFIG: IRateLimitConfig = {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    maxConcurrentExecutions: 5,
}

interface WindowEntry {
    readonly timestamp: number
}

export class RateLimiter implements IRateLimiterPort {
    private readonly configs: Map<string, IRateLimitConfig> = new Map()
    private readonly minuteWindows: Map<string, WindowEntry[]> = new Map()
    private readonly hourWindows: Map<string, WindowEntry[]> = new Map()
    private readonly concurrentCounts: Map<string, number> = new Map()

    private key(agentId: string, workspaceId: string): string {
        return `${workspaceId}:${agentId}`
    }

    private pruneWindow(entries: WindowEntry[], windowMs: number): WindowEntry[] {
        const cutoff = Date.now() - windowMs
        return entries.filter(e => e.timestamp > cutoff)
    }

    async check(agentId: string, workspaceId: string): Promise<IRateLimitCheckResult> {
        const k = this.key(agentId, workspaceId)
        const config = this.configs.get(agentId) ?? DEFAULT_CONFIG

        const minuteEntries = this.pruneWindow(this.minuteWindows.get(k) ?? [], 60_000)
        this.minuteWindows.set(k, minuteEntries)

        if (minuteEntries.length >= config.maxRequestsPerMinute) {
            const oldest = minuteEntries[0]!
            const retryAfterMs = 60_000 - (Date.now() - oldest.timestamp)
            log.warn('Rate limit exceeded (minute)', { agentId, workspaceId })
            return {
                allowed: false,
                retryAfterMs: Math.max(0, retryAfterMs),
                currentCount: minuteEntries.length,
                limit: config.maxRequestsPerMinute,
                windowType: 'minute',
            }
        }

        const hourEntries = this.pruneWindow(this.hourWindows.get(k) ?? [], 3_600_000)
        this.hourWindows.set(k, hourEntries)

        if (hourEntries.length >= config.maxRequestsPerHour) {
            const oldest = hourEntries[0]!
            const retryAfterMs = 3_600_000 - (Date.now() - oldest.timestamp)
            log.warn('Rate limit exceeded (hour)', { agentId, workspaceId })
            return {
                allowed: false,
                retryAfterMs: Math.max(0, retryAfterMs),
                currentCount: hourEntries.length,
                limit: config.maxRequestsPerHour,
                windowType: 'hour',
            }
        }

        const concurrent = this.concurrentCounts.get(k) ?? 0
        if (concurrent >= config.maxConcurrentExecutions) {
            log.warn('Rate limit exceeded (concurrent)', { agentId, workspaceId })
            return {
                allowed: false,
                retryAfterMs: 1000,
                currentCount: concurrent,
                limit: config.maxConcurrentExecutions,
                windowType: 'concurrent',
            }
        }

        return {
            allowed: true,
            retryAfterMs: 0,
            currentCount: minuteEntries.length,
            limit: config.maxRequestsPerMinute,
            windowType: 'minute',
        }
    }

    async record(agentId: string, workspaceId: string): Promise<void> {
        const k = this.key(agentId, workspaceId)
        const now = Date.now()
        const entry: WindowEntry = { timestamp: now }

        const minuteEntries = this.minuteWindows.get(k) ?? []
        minuteEntries.push(entry)
        this.minuteWindows.set(k, minuteEntries)

        const hourEntries = this.hourWindows.get(k) ?? []
        hourEntries.push(entry)
        this.hourWindows.set(k, hourEntries)

        const concurrent = this.concurrentCounts.get(k) ?? 0
        this.concurrentCounts.set(k, concurrent + 1)
    }

    async release(agentId: string, workspaceId: string): Promise<void> {
        const k = this.key(agentId, workspaceId)
        const concurrent = this.concurrentCounts.get(k) ?? 0
        this.concurrentCounts.set(k, Math.max(0, concurrent - 1))
    }

    async getConfig(agentId: string): Promise<IRateLimitConfig> {
        return this.configs.get(agentId) ?? DEFAULT_CONFIG
    }

    async setConfig(agentId: string, config: IRateLimitConfig): Promise<void> {
        this.configs.set(agentId, config)
        log.info('Rate limit config updated', { agentId })
    }
}
