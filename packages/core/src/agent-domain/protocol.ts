import type { ICapabilityGrant } from '../capability-domain/types.js'

export interface IAgentToAgentMessage {
    readonly messageId: string
    readonly from: string
    readonly to: string
    readonly timestamp: string
    readonly payload: Readonly<Record<string, unknown>>
    readonly replyTo?: string
    readonly capabilities?: Readonly<ICapabilityGrant>
}

export interface IAgentMessageContract {
    readonly allowedPayloadKeys: readonly string[]
    readonly maxPayloadSizeBytes: number
    readonly requiresCapability: string
}

export type CapabilityPropagationRule = 'none' | 'subset' | 'full'

export interface IIsolationGuarantee {
    readonly memoryIsolated: boolean
    readonly stateIsolated: boolean
    readonly budgetIsolated: boolean
}

export interface IAgentProtocolConfig {
    readonly propagationRule: CapabilityPropagationRule
    readonly isolation: IIsolationGuarantee
    readonly maxMessageSizeBytes: number
    readonly maxCallDepth: number
}

export interface IAgentEventBusPort {
    send(message: IAgentToAgentMessage): Promise<void>
    subscribe(agentId: string, handler: (message: IAgentToAgentMessage) => void): () => void
}
