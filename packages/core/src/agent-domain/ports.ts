import type { IAgentDefinition } from './types.js'

export interface IAgentRegistry {
    register(definition: IAgentDefinition): void
    get(agentId: string): IAgentDefinition | null
    list(): IAgentDefinition[]
    has(agentId: string): boolean
    unregister(agentId: string): void
}

export interface IOrchestrator {
    callAgent(
        parentExecutionId: string,
        childAgentId: string,
        input: Readonly<Record<string, unknown>>
    ): Promise<unknown>
    hasCircularCall(executionId: string, agentId: string): boolean
}

export const MAX_AGENT_CALL_DEPTH = 5
