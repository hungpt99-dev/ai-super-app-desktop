import type { IPolicy, PolicyDecision } from './types.js'

export interface IPolicyEngine {
    addPolicy(policy: IPolicy): void
    removePolicy(name: string): void
    evaluate(agentId: string, action: string, context?: Readonly<Record<string, unknown>>): PolicyDecision
    list(): IPolicy[]
}
