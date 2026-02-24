/**
 * ActingTypes — domain types for the capability-gated acting engine.
 *
 * Main process only. No renderer imports.
 */

export interface ToolDefinition {
    readonly name: string
    readonly description: string
    readonly requiredCapabilities: readonly string[]
    execute(input: unknown): Promise<unknown>
}

export interface ToolCallRecord {
    readonly toolName: string
    readonly input: unknown
    readonly output: unknown
    readonly durationMs: number
    readonly timestamp: string
}

export interface MemoryDelta {
    readonly key: string
    readonly previousValue: unknown
    readonly newValue: unknown
}

export interface CapabilityCheck {
    readonly capability: string
    readonly required: boolean
    readonly granted: boolean
}

export interface ExecutionResult {
    readonly executionId: string
    readonly agent: string
    readonly toolCalls: readonly ToolCallRecord[]
    readonly memoryChanges: readonly MemoryDelta[]
    readonly capabilityChecks: readonly CapabilityCheck[]
    readonly status: 'completed' | 'failed'
}

export interface AgentMessage {
    readonly messageId: string
    readonly fromAgent: string
    readonly toAgent: string
    readonly type: 'request' | 'response' | 'event'
    readonly payload: unknown
    readonly timestamp: string
}

export interface AgentTransport {
    send(message: AgentMessage): Promise<AgentMessage>
}
