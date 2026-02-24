/**
 * BudgetManager — tracks and enforces token budgets per agent per workspace.
 *
 * Implements IBudgetManagerPort from core.
 */

import type { GovernanceDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type IBudgetManagerPort = GovernanceDomain.IBudgetManagerPort
type IBudgetRecord = GovernanceDomain.IBudgetRecord
type IBudgetCheckResult = GovernanceDomain.IBudgetCheckResult

const log = logger.child('BudgetManager')

export class BudgetManager implements IBudgetManagerPort {
    private readonly budgets: Map<string, IBudgetRecord> = new Map()

    private key(agentId: string, workspaceId: string): string {
        return `${workspaceId}:${agentId}`
    }

    async check(agentId: string, workspaceId: string, estimatedTokens: number): Promise<IBudgetCheckResult> {
        const record = this.budgets.get(this.key(agentId, workspaceId))
        if (!record) {
            return {
                allowed: true,
                remainingTokens: Infinity,
                totalUsed: 0,
                budgetLimit: Infinity,
                estimatedCost: 0,
            }
        }

        const remaining = record.budgetLimit - record.totalTokensUsed
        const allowed = remaining >= estimatedTokens

        if (!allowed) {
            log.warn('Budget check failed', { agentId, workspaceId, remaining, estimatedTokens })
        }

        return {
            allowed,
            remainingTokens: Math.max(0, remaining),
            totalUsed: record.totalTokensUsed,
            budgetLimit: record.budgetLimit,
            estimatedCost: record.totalCostUsd,
        }
    }

    async record(agentId: string, workspaceId: string, tokensUsed: number, costUsd: number): Promise<void> {
        const k = this.key(agentId, workspaceId)
        const existing = this.budgets.get(k)

        if (existing) {
            this.budgets.set(k, {
                ...existing,
                totalTokensUsed: existing.totalTokensUsed + tokensUsed,
                totalCostUsd: existing.totalCostUsd + costUsd,
            })
        } else {
            const now = new Date().toISOString()
            this.budgets.set(k, {
                agentId,
                workspaceId,
                totalTokensUsed: tokensUsed,
                totalCostUsd: costUsd,
                budgetLimit: Infinity,
                periodStart: now,
                periodEnd: now,
            })
        }

        log.info('Budget recorded', { agentId, workspaceId, tokensUsed, costUsd })
    }

    async getBudget(agentId: string, workspaceId: string): Promise<IBudgetRecord | null> {
        return this.budgets.get(this.key(agentId, workspaceId)) ?? null
    }

    async setBudgetLimit(agentId: string, workspaceId: string, limit: number): Promise<void> {
        const k = this.key(agentId, workspaceId)
        const existing = this.budgets.get(k)
        const now = new Date().toISOString()

        if (existing) {
            this.budgets.set(k, { ...existing, budgetLimit: limit })
        } else {
            this.budgets.set(k, {
                agentId,
                workspaceId,
                totalTokensUsed: 0,
                totalCostUsd: 0,
                budgetLimit: limit,
                periodStart: now,
                periodEnd: now,
            })
        }

        log.info('Budget limit set', { agentId, workspaceId, limit })
    }

    async resetBudget(agentId: string, workspaceId: string): Promise<void> {
        const k = this.key(agentId, workspaceId)
        const existing = this.budgets.get(k)
        const now = new Date().toISOString()

        if (existing) {
            this.budgets.set(k, {
                ...existing,
                totalTokensUsed: 0,
                totalCostUsd: 0,
                periodStart: now,
                periodEnd: now,
            })
        }

        log.info('Budget reset', { agentId, workspaceId })
    }
}
