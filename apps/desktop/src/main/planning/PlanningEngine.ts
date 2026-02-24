/**
 * PlanningEngine — cost-optimized, deterministic planning with depth limit.
 *
 * Two modes:
 * - SKELETON: up to 5 high-level steps
 * - MICRO: up to 3 tool-level actions per step
 *
 * Rules:
 * - Max depth = 1 (no recursive planning beyond SKELETON → MICRO)
 * - Deterministic JSON output only
 * - No chain-of-thought, no explanation text
 * - Budget enforced on every operation
 * - If shouldPlan == false → returns DirectExecutePlan
 *
 * Main process only. No renderer imports.
 */

import type {
    SkeletonPlan,
    DirectExecutePlan,
    MicroPlan,
    SkeletonStep,
    MicroAction,
    AgentCandidate,
    PlanningBudgetConfig,
} from './PlanningTypes.js'
import { PLANNING_LIMITS } from './PlanningTypes.js'
import { shouldPlan } from './PlanningHeuristic.js'
import { selectAgents } from './AgentSelector.js'
import { PlanningBudget } from './PlanningBudget.js'

let planCounter = 0
let stepCounter = 0
let actionCounter = 0

function nextPlanId(): string {
    planCounter++
    return `plan_${planCounter.toString().padStart(6, '0')}`
}

function nextStepId(): string {
    stepCounter++
    return `step_${stepCounter.toString().padStart(6, '0')}`
}

function nextActionId(): string {
    actionCounter++
    return `action_${actionCounter.toString().padStart(6, '0')}`
}

function estimateStepTokens(action: string): number {
    return Math.ceil(action.split(/\s+/).filter(Boolean).length * 1.5)
}

export class PlanningEngine {
    createPlan(
        input: string,
        agents: readonly AgentCandidate[],
        budgetConfig: PlanningBudgetConfig,
    ): SkeletonPlan | DirectExecutePlan {
        const now = new Date().toISOString()

        if (!shouldPlan(input)) {
            const selected = selectAgents(agents, [])
            const agent = selected[0]
            return {
                planId: nextPlanId(),
                mode: 'DIRECT',
                agentId: agent ? agent.agentId : 'default',
                action: input,
                createdAt: now,
            }
        }

        const budget = new PlanningBudget(budgetConfig)
        budget.enterDepth()

        const sentences = input
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter(Boolean)

        const requiredCaps = this.extractCapabilities(input)
        const selected = selectAgents(agents, requiredCaps)

        const steps: SkeletonStep[] = []
        const maxSteps = Math.min(sentences.length, PLANNING_LIMITS.MAX_SKELETON_STEPS)

        for (let i = 0; i < maxSteps; i++) {
            const sentence = sentences[i]
            if (!sentence) break

            budget.incrementStep()

            const tokensForStep = estimateStepTokens(sentence)
            budget.consumeTokens(tokensForStep)

            const assignedAgent = selected[i % selected.length]

            steps.push({
                stepId: nextStepId(),
                agentId: assignedAgent ? assignedAgent.agentId : 'default',
                action: sentence,
                toolName: this.inferToolName(sentence),
                input: { raw: sentence },
                expectedOutput: 'structured_result',
            })
        }

        budget.exitDepth()

        return {
            planId: nextPlanId(),
            mode: 'SKELETON',
            steps,
            estimatedTokens: budget.getTokenCount(),
            createdAt: now,
        }
    }

    createMicroPlan(step: SkeletonStep, budgetConfig: PlanningBudgetConfig): MicroPlan {
        const budget = new PlanningBudget(budgetConfig)
        budget.enterDepth()

        const parts = step.action
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean)

        const actions: MicroAction[] = []
        const maxActions = Math.min(parts.length, PLANNING_LIMITS.MAX_MICRO_ACTIONS)

        for (let i = 0; i < maxActions; i++) {
            const part = parts[i]
            if (!part) break

            const tokensForAction = estimateStepTokens(part)
            budget.consumeTokens(tokensForAction)

            actions.push({
                actionId: nextActionId(),
                toolName: this.inferToolName(part),
                input: { raw: part },
                expectedOutput: 'action_result',
            })
        }

        budget.exitDepth()

        return {
            planId: nextPlanId(),
            stepId: step.stepId,
            actions,
            estimatedTokens: budget.getTokenCount(),
            createdAt: new Date().toISOString(),
        }
    }

    private extractCapabilities(input: string): readonly string[] {
        const lower = input.toLowerCase()
        const caps: string[] = []

        if (lower.includes('file') || lower.includes('read') || lower.includes('write')) {
            caps.push('filesystem')
        }
        if (lower.includes('http') || lower.includes('api') || lower.includes('fetch')) {
            caps.push('network')
        }
        if (lower.includes('browser') || lower.includes('web') || lower.includes('url')) {
            caps.push('browser')
        }
        if (lower.includes('exec') || lower.includes('shell') || lower.includes('command')) {
            caps.push('os')
        }

        return caps
    }

    private inferToolName(text: string): string {
        const lower = text.toLowerCase()
        if (lower.includes('read file') || lower.includes('load file')) return 'file.read'
        if (lower.includes('write file') || lower.includes('save file')) return 'file.write'
        if (lower.includes('open browser') || lower.includes('browse')) return 'browser.open'
        if (lower.includes('fetch') || lower.includes('http') || lower.includes('api')) return 'http.fetch'
        if (lower.includes('exec') || lower.includes('run command') || lower.includes('shell')) return 'os.exec'
        return 'noop'
    }
}
