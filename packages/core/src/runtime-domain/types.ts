import type { MemoryScope } from '@agenthub/shared'

export type ExecutionLifecycleState =
    | 'created'
    | 'validated'
    | 'planned'
    | 'scheduled'
    | 'running'
    | 'tool_execution'
    | 'memory_injection'
    | 'completed'
    | 'snapshot_persisted'
    | 'failed'
    | 'aborted'

export const VALID_TRANSITIONS: ReadonlyMap<ExecutionLifecycleState, readonly ExecutionLifecycleState[]> =
    new Map<ExecutionLifecycleState, readonly ExecutionLifecycleState[]>([
        ['created', ['validated', 'failed']],
        ['validated', ['planned', 'failed']],
        ['planned', ['scheduled', 'failed']],
        ['scheduled', ['running', 'aborted', 'failed']],
        ['running', ['tool_execution', 'memory_injection', 'completed', 'failed', 'aborted']],
        ['tool_execution', ['running', 'failed', 'aborted']],
        ['memory_injection', ['running', 'failed', 'aborted']],
        ['completed', ['snapshot_persisted']],
        ['snapshot_persisted', []],
        ['failed', ['snapshot_persisted']],
        ['aborted', ['snapshot_persisted']],
    ])

export interface IExecutionContext {
    readonly executionId: string
    readonly agentId: string
    readonly sessionId: string
    readonly graphId: string
    currentNodeId: string
    variables: Record<string, unknown>
    callStack: readonly IAgentCallFrame[]
    memoryScope: MemoryScope
    tokenUsage: ITokenUsage
    budgetRemaining: number
    lifecycleState: ExecutionLifecycleState
}

export interface IAgentCallFrame {
    readonly agentId: string
    readonly graphId: string
    readonly nodeId: string
    readonly depth: number
}

export interface ITokenUsage {
    promptTokens: number
    completionTokens: number
    estimatedCost: number
}

export interface ISnapshotContent {
    readonly executionId: string
    readonly agentId: string
    readonly graphId: string
    readonly nodePointer: string
    readonly timestamp: string
    readonly variables: Readonly<Record<string, unknown>>
    readonly callStack: readonly IAgentCallFrame[]
    readonly lifecycleState: ExecutionLifecycleState
    readonly tokenUsage: Readonly<ITokenUsage>
    readonly memoryReference?: string
    readonly eventLogReference?: string
}

export interface ITokenTrackingRecord {
    readonly executionId: string
    readonly agentId: string
    readonly model: string
    readonly timestamp: string
    readonly promptTokens: number
    readonly completionTokens: number
    readonly estimatedCostUsd: number
}

export type PluginType = 'tool' | 'provider' | 'memory_backend' | 'ui_component'

export interface IPlugin {
    readonly name: string
    readonly version: string
    readonly type: PluginType
}
