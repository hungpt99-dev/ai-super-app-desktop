/**
 * GovernanceEnforcer — orchestrates policy, budget, rate-limit, and model checks.
 *
 * Called by ExecutionService.start() BEFORE the planning phase.
 * If any check fails, it emits ExecutionRejected and returns violations.
 */

import type { GovernanceDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type IPolicyEnginePort = GovernanceDomain.IPolicyEnginePort
type IBudgetManagerPort = GovernanceDomain.IBudgetManagerPort
type IRateLimiterPort = GovernanceDomain.IRateLimiterPort
type IModelRegistryPort = GovernanceDomain.IModelRegistryPort
type IPolicyContext = GovernanceDomain.IPolicyContext
type IPolicyViolation = GovernanceDomain.IPolicyViolation
type IPolicyEvaluationResult = GovernanceDomain.IPolicyEvaluationResult

const log = logger.child('GovernanceEnforcer')

export interface IGovernanceEnforcerConfig {
    readonly policyEngine: IPolicyEnginePort
    readonly budgetManager: IBudgetManagerPort
    readonly rateLimiter: IRateLimiterPort
    readonly modelRegistry: IModelRegistryPort
}

export class GovernanceEnforcer {
    private readonly policyEngine: IPolicyEnginePort
    private readonly budgetManager: IBudgetManagerPort
    private readonly rateLimiter: IRateLimiterPort
    private readonly modelRegistry: IModelRegistryPort

    constructor(config: IGovernanceEnforcerConfig) {
        this.policyEngine = config.policyEngine
        this.budgetManager = config.budgetManager
        this.rateLimiter = config.rateLimiter
        this.modelRegistry = config.modelRegistry
    }

    async enforce(context: IPolicyContext): Promise<IPolicyEvaluationResult> {
        const violations: IPolicyViolation[] = []

        log.info('Governance enforcement started', {
            agentId: context.agentId,
            workspaceId: context.workspaceId,
        })

        const policyResult = await this.policyEngine.evaluate(context)
        if (!policyResult.allowed) {
            violations.push(...policyResult.violations)
        }

        const budgetResult = await this.budgetManager.check(
            context.agentId,
            context.workspaceId,
            context.maxTokenBudget ?? 0,
        )
        if (!budgetResult.allowed) {
            violations.push({
                code: 'BUDGET_EXCEEDED',
                message: `Token budget exceeded. Used: ${budgetResult.totalUsed}, Limit: ${budgetResult.budgetLimit}, Remaining: ${budgetResult.remainingTokens}`,
                severity: 'error',
                field: 'budget',
            })
        }

        const rateLimitResult = await this.rateLimiter.check(
            context.agentId,
            context.workspaceId,
        )
        if (!rateLimitResult.allowed) {
            violations.push({
                code: 'RATE_LIMIT_EXCEEDED',
                message: `Rate limit exceeded (${rateLimitResult.windowType}). Current: ${rateLimitResult.currentCount}, Limit: ${rateLimitResult.limit}. Retry after ${rateLimitResult.retryAfterMs}ms.`,
                severity: 'error',
                field: 'rate_limit',
                metadata: { retryAfterMs: rateLimitResult.retryAfterMs },
            })
        }

        if (context.model) {
            const modelAllowed = await this.modelRegistry.isAllowed(
                context.model,
                context.workspaceId,
            )
            if (!modelAllowed) {
                violations.push({
                    code: 'MODEL_NOT_ALLOWED',
                    message: `Model "${context.model}" is not allowed in workspace "${context.workspaceId}".`,
                    severity: 'error',
                    field: 'model',
                })
            }
        }

        const hasErrors = violations.some(v => v.severity === 'error')

        if (hasErrors) {
            log.warn('Governance enforcement failed', {
                agentId: context.agentId,
                violationCount: violations.length,
            })
        } else {
            log.info('Governance enforcement passed', { agentId: context.agentId })
        }

        return {
            allowed: !hasErrors,
            violations,
            evaluatedAt: new Date().toISOString(),
        }
    }
}
