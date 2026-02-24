export type CapabilityScope =
    | 'tool'
    | 'network'
    | 'memory'
    | 'token_budget'
    | 'agent_boundary'

export interface ICapability {
    readonly name: string
    readonly description: string
    readonly scope: CapabilityScope
}

export interface ICapabilityGrant {
    readonly agentId: string
    readonly capabilities: readonly ICapability[]
    readonly tokenBudget: number
    readonly maxCostUsd: number
}

export interface ICapabilityConstraint {
    readonly allowedTools: readonly string[]
    readonly allowedNetworkHosts: readonly string[]
    readonly allowedMemoryScopes: readonly string[]
    readonly maxTokenBudget: number
    readonly allowedAgentTargets: readonly string[]
}
