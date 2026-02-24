import type { ICapability, ICapabilityGrant, ICapabilityConstraint, CapabilityScope } from './types.js'

export interface ICapabilityRegistry {
    register(capability: ICapability): void
    get(name: string): ICapability | null
    list(): ICapability[]
    has(name: string): boolean
    listByScope(scope: CapabilityScope): ICapability[]
}

export interface ICapabilityVerifier {
    verify(agentId: string, capabilityName: string): boolean
    verifyToolCall(agentId: string, toolName: string): boolean
    verifyProviderCall(agentId: string): boolean
    verifyMemoryInjection(agentId: string, scope: string): boolean
    verifyCrossAgentMessage(fromAgentId: string, toAgentId: string): boolean
    getGrant(agentId: string): ICapabilityGrant | null
    getConstraints(agentId: string): ICapabilityConstraint | null
    grant(grant: ICapabilityGrant): void
    revoke(agentId: string): void
}
