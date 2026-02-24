/**
 * PlanningBudget — enforces hard limits on token usage, step count, and depth.
 *
 * Throws BudgetExceededError if any limit is violated.
 * No soft limits. Deterministic enforcement only.
 */

import type { PlanningBudgetConfig } from './PlanningTypes.js'
import { PLANNING_LIMITS } from './PlanningTypes.js'

export class BudgetExceededError extends Error {
    public readonly limit: string
    public readonly current: number
    public readonly maximum: number

    constructor(limit: string, current: number, maximum: number) {
        super(`Budget exceeded: ${limit} — current=${current}, max=${maximum}`)
        this.name = 'BudgetExceededError'
        this.limit = limit
        this.current = current
        this.maximum = maximum
    }
}

export class PlanningBudget {
    private tokenCount: number = 0
    private stepCount: number = 0
    private currentDepth: number = 0
    private readonly config: Readonly<PlanningBudgetConfig>

    constructor(config: PlanningBudgetConfig) {
        this.config = Object.freeze({ ...config })
    }

    consumeTokens(count: number): void {
        const next = this.tokenCount + count
        if (next > this.config.maxTokens) {
            throw new BudgetExceededError('maxTokens', next, this.config.maxTokens)
        }
        this.tokenCount = next
    }

    incrementStep(): void {
        const next = this.stepCount + 1
        const effectiveMax = Math.min(this.config.maxSteps, PLANNING_LIMITS.MAX_SKELETON_STEPS)
        if (next > effectiveMax) {
            throw new BudgetExceededError('maxSteps', next, effectiveMax)
        }
        this.stepCount = next
    }

    enterDepth(): void {
        const next = this.currentDepth + 1
        const effectiveMax = Math.min(this.config.maxDepth, PLANNING_LIMITS.MAX_DEPTH)
        if (next > effectiveMax) {
            throw new BudgetExceededError('maxDepth', next, effectiveMax)
        }
        this.currentDepth = next
    }

    exitDepth(): void {
        if (this.currentDepth > 0) {
            this.currentDepth -= 1
        }
    }

    getTokenCount(): number {
        return this.tokenCount
    }

    getStepCount(): number {
        return this.stepCount
    }

    getCurrentDepth(): number {
        return this.currentDepth
    }

    getRemainingTokens(): number {
        return Math.max(0, this.config.maxTokens - this.tokenCount)
    }

    getRemainingSteps(): number {
        const effectiveMax = Math.min(this.config.maxSteps, PLANNING_LIMITS.MAX_SKELETON_STEPS)
        return Math.max(0, effectiveMax - this.stepCount)
    }
}
