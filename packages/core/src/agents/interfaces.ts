/**
 * Agent interfaces — defines the agent abstraction for multi-agent systems.
 *
 * See: docs/technical-design.md §7 MULTI-AGENT SYSTEM
 */

import type { AgentLifecycleState } from '@agenthub/shared'

// ─── Agent Definition ───────────────────────────────────────────────────────

export interface IAgentDefinition {
    readonly id: string
    readonly name: string
    readonly description: string
    readonly graphId: string
    /** Maximum token budget for a single execution. */
    readonly maxTokenBudget: number
}

// ─── Agent Instance ─────────────────────────────────────────────────────────

export interface IAgentInstance {
    readonly agentId: string
    readonly executionId: string
    state: AgentLifecycleState
    /** Pause the agent after the current node completes. */
    pause(): Promise<void>
    /** Resume from a paused state. */
    resume(): Promise<void>
    /** Abort the execution. */
    abort(): Promise<void>
}

// ─── Agent Registry ─────────────────────────────────────────────────────────

export interface IAgentRegistry {
    register(definition: IAgentDefinition): void
    get(agentId: string): IAgentDefinition | null
    list(): IAgentDefinition[]
    has(agentId: string): boolean
}
