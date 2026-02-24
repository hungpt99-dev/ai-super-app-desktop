import type { AgentLifecycleState } from '@agenthub/shared'

export interface IAgentDefinition {
    readonly id: string
    readonly name: string
    readonly description: string
    readonly graphId: string
    readonly maxTokenBudget: number
    readonly requiredCapabilities: readonly string[]
}

export interface IAgentInstance {
    readonly agentId: string
    readonly executionId: string
    state: AgentLifecycleState
    pause(): Promise<void>
    resume(): Promise<void>
    abort(): Promise<void>
}
