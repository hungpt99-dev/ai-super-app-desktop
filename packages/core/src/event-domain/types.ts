import type { AgentLifecycleState } from '@agenthub/shared'

export type DomainEventType =
    | 'agent.registered'
    | 'agent.state_changed'
    | 'execution.created'
    | 'execution.validated'
    | 'execution.planned'
    | 'execution.scheduled'
    | 'execution.running'
    | 'execution.tool_call'
    | 'execution.tool_result'
    | 'execution.memory_injection'
    | 'execution.completed'
    | 'execution.failed'
    | 'execution.aborted'
    | 'execution.snapshot_persisted'
    | 'graph.validated'
    | 'graph.node_entered'
    | 'graph.node_exited'
    | 'memory.read'
    | 'memory.write'
    | 'memory.pruned'
    | 'capability.checked'
    | 'capability.denied'
    | 'policy.evaluated'
    | 'budget.warning'
    | 'budget.exceeded'
    | 'agent_message.sent'
    | 'agent_message.received'
    | 'stream.chunk'

export interface IDomainEvent {
    readonly type: DomainEventType
    readonly timestamp: string
    readonly executionId?: string
    readonly agentId?: string
    readonly data: Readonly<Record<string, unknown>>
}

export interface IAgentStateChangedEvent extends IDomainEvent {
    readonly type: 'agent.state_changed'
    readonly data: {
        readonly previousState: AgentLifecycleState
        readonly newState: AgentLifecycleState
    }
}

export interface IExecutionLifecycleEvent extends IDomainEvent {
    readonly type:
        | 'execution.created'
        | 'execution.validated'
        | 'execution.planned'
        | 'execution.scheduled'
        | 'execution.running'
        | 'execution.completed'
        | 'execution.failed'
        | 'execution.aborted'
        | 'execution.snapshot_persisted'
}

export interface IToolCallEvent extends IDomainEvent {
    readonly type: 'execution.tool_call'
    readonly data: {
        readonly toolName: string
        readonly input: Readonly<Record<string, unknown>>
    }
}

export interface IToolResultEvent extends IDomainEvent {
    readonly type: 'execution.tool_result'
    readonly data: {
        readonly toolName: string
        readonly success: boolean
        readonly durationMs: number
    }
}

export interface IMemoryEvent extends IDomainEvent {
    readonly type: 'memory.read' | 'memory.write' | 'memory.pruned'
}

export interface ICapabilityEvent extends IDomainEvent {
    readonly type: 'capability.checked' | 'capability.denied'
    readonly data: {
        readonly capabilityName: string
        readonly agentId: string
    }
}

export interface IBudgetEvent extends IDomainEvent {
    readonly type: 'budget.warning' | 'budget.exceeded'
    readonly data: {
        readonly budgetRemaining: number
        readonly budgetLimit: number
    }
}

export interface IAgentMessageEvent extends IDomainEvent {
    readonly type: 'agent_message.sent' | 'agent_message.received'
    readonly data: {
        readonly from: string
        readonly to: string
        readonly payload: Readonly<Record<string, unknown>>
    }
}
