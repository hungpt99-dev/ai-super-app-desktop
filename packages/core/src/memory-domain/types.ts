export type MemoryType = 'episodic' | 'semantic' | 'procedural'
export type CoreMemoryScope = 'working' | 'session' | 'long-term'
export type PruningStrategy = 'importance_decay' | 'time_ttl' | 'auto_summarize' | 'manual'

export interface IMemoryItem {
    readonly id: string
    readonly agentId: string
    readonly scope: string
    readonly type: MemoryType
    readonly content: string
    readonly importance: number
    readonly embedding: number[]
    readonly createdAt: string
    readonly updatedAt?: string
}

export interface IMemoryResult {
    readonly item: IMemoryItem
    readonly score: number
}

export interface IPruningConfig {
    readonly strategy: PruningStrategy
    readonly ttlSeconds?: number
    readonly minImportance?: number
}

export interface IAgentMessage {
    readonly type: 'agent_message'
    readonly from: string
    readonly to: string
    readonly timestamp: string
    readonly payload: Readonly<Record<string, unknown>>
}
