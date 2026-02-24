/**
 * PlanningTypes — core domain types for the cost-optimized planning engine.
 *
 * Main process only. No renderer imports.
 */

export type PlanningMode = 'SKELETON' | 'MICRO'

export interface SkeletonStep {
    readonly stepId: string
    readonly agentId: string
    readonly action: string
    readonly toolName: string
    readonly input: Record<string, unknown>
    readonly expectedOutput: string
}

export interface MicroAction {
    readonly actionId: string
    readonly toolName: string
    readonly input: Record<string, unknown>
    readonly expectedOutput: string
}

export interface SkeletonPlan {
    readonly planId: string
    readonly mode: 'SKELETON'
    readonly steps: readonly SkeletonStep[]
    readonly estimatedTokens: number
    readonly createdAt: string
}

export interface DirectExecutePlan {
    readonly planId: string
    readonly mode: 'DIRECT'
    readonly agentId: string
    readonly action: string
    readonly createdAt: string
}

export interface MicroPlan {
    readonly planId: string
    readonly stepId: string
    readonly actions: readonly MicroAction[]
    readonly estimatedTokens: number
    readonly createdAt: string
}

export interface AgentCandidate {
    readonly agentId: string
    readonly name: string
    readonly capabilities: readonly string[]
    readonly costPerToken: number
}

export interface PlanningBudgetConfig {
    readonly maxTokens: number
    readonly maxSteps: number
    readonly maxDepth: number
}

export const PLANNING_LIMITS = {
    MAX_SKELETON_STEPS: 5,
    MAX_MICRO_ACTIONS: 3,
    MAX_DEPTH: 1,
    MAX_AGENT_CANDIDATES: 3,
    MIN_TOKEN_THRESHOLD: 40,
} as const

export const PLANNING_KEYWORDS: readonly string[] = [
    'plan',
    'strategy',
    'compare',
    'analyze',
    'workflow',
] as const
