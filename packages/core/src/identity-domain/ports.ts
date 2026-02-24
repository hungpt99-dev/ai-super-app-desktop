import type { IAgentIdentity } from './types.js'

export interface IIdentityResolver {
    resolve(agentId: string): Promise<IAgentIdentity | null>
    register(identity: IAgentIdentity): Promise<void>
    list(): Promise<IAgentIdentity[]>
    revoke(agentId: string): Promise<void>
}
