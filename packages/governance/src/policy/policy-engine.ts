/**
 * PolicyEngine — evaluates execution policies before planning phase.
 *
 * Implements IPolicyEnginePort from core.
 * All rules are evaluated sequentially by priority.
 * A single error-severity violation blocks execution.
 */

import type {
    GovernanceDomain,
} from '@agenthub/core'
import { logger } from '@agenthub/shared'

type IPolicyEnginePort = GovernanceDomain.IPolicyEnginePort
type IPolicyRule = GovernanceDomain.IPolicyRule
type IPolicyContext = GovernanceDomain.IPolicyContext
type IPolicyEvaluationResult = GovernanceDomain.IPolicyEvaluationResult
type IPolicyViolation = GovernanceDomain.IPolicyViolation

const log = logger.child('PolicyEngine')

export class PolicyEngine implements IPolicyEnginePort {
    private readonly rules: Map<string, IPolicyRule> = new Map()

    async evaluate(context: IPolicyContext): Promise<IPolicyEvaluationResult> {
        log.info('Evaluating policies', { agentId: context.agentId, workspaceId: context.workspaceId })

        const violations: IPolicyViolation[] = []
        const sortedRules = [...this.rules.values()]
            .filter(r => r.enabled)
            .sort((a, b) => a.priority - b.priority)

        for (const rule of sortedRules) {
            try {
                const result = rule.evaluate(context)
                if (!result.allowed) {
                    violations.push(...result.violations)
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                log.error('Policy rule evaluation failed', { ruleId: rule.id, error: message })
                violations.push({
                    code: 'POLICY_RULE_ERROR',
                    message: `Policy rule "${rule.name}" failed: ${message}`,
                    severity: 'error',
                    field: rule.id,
                })
            }
        }

        const hasErrors = violations.some(v => v.severity === 'error')

        if (hasErrors) {
            log.warn('Policy evaluation failed', { violationCount: violations.length })
        } else {
            log.info('Policy evaluation passed')
        }

        return {
            allowed: !hasErrors,
            violations,
            evaluatedAt: new Date().toISOString(),
        }
    }

    addRule(rule: IPolicyRule): void {
        this.rules.set(rule.id, rule)
        log.info('Policy rule added', { ruleId: rule.id, name: rule.name })
    }

    removeRule(ruleId: string): void {
        this.rules.delete(ruleId)
        log.info('Policy rule removed', { ruleId })
    }

    listRules(): readonly IPolicyRule[] {
        return [...this.rules.values()]
    }

    enableRule(ruleId: string): void {
        const rule = this.rules.get(ruleId)
        if (rule) {
            this.rules.set(ruleId, { ...rule, enabled: true })
        }
    }

    disableRule(ruleId: string): void {
        const rule = this.rules.get(ruleId)
        if (rule) {
            this.rules.set(ruleId, { ...rule, enabled: false })
        }
    }
}
