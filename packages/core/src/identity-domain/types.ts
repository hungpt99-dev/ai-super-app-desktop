export interface IAgentIdentity {
    readonly agentId: string
    readonly name: string
    readonly version: string
    readonly owner?: string
    readonly publicKey?: string
}
