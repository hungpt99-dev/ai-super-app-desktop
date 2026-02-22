/**
 * Orchestrator — manages multi-agent execution and call stacks.
 *
 * See: docs/technical-design.md §7 MULTI-AGENT SYSTEM
 */

// ─── Orchestrator Interface ─────────────────────────────────────────────────

/** Maximum agent call depth to prevent infinite recursion. */
export const MAX_AGENT_CALL_DEPTH = 5

export interface IOrchestrator {
    /**
     * Dispatch an AGENT_CALL_NODE — creates a new ExecutionContext,
     * pushes to the call stack, and returns the result to the parent.
     */
    callAgent(parentExecutionId: string, childAgentId: string, input: Record<string, unknown>): Promise<unknown>

    /** Detect circular agent calls in the current call stack. */
    hasCircularCall(executionId: string, agentId: string): boolean
}

// ─── Agent Communication Bus ────────────────────────────────────────────────

export interface IAgentMessage {
    readonly type: 'agent_message'
    readonly from: string
    readonly to: string
    readonly payload: Record<string, unknown>
    readonly timestamp: string
}
