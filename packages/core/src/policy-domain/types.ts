export type PolicyDecision = 'allow' | 'deny' | 'prompt'

export interface IPolicy {
    readonly name: string
    readonly description: string
    evaluate(agentId: string, action: string, context?: Readonly<Record<string, unknown>>): PolicyDecision
}

export type BudgetScope = 'agent' | 'session' | 'workspace'

export interface IBudgetPolicy {
    readonly scope: BudgetScope
    readonly maxTokens: number
    readonly maxCostUsd: number
}
