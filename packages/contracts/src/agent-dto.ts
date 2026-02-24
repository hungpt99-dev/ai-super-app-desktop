/**
 * Agent DTOs — serializable data transfer objects for agents.
 *
 * Used for IPC (main ↔ renderer), API responses (desktop ↔ cloud),
 * and event payloads. No behaviour — pure data shapes.
 *
 * See: docs/technical-design.md §2 AGENT SYSTEM
 */

// ─── Agent State ────────────────────────────────────────────────────────────

export type AgentStatus = 'idle' | 'initializing' | 'running' | 'waiting_approval' | 'paused' | 'completed' | 'failed' | 'aborted'

// ─── Agent DTO ──────────────────────────────────────────────────────────────

export interface IAgentDTO {
    readonly id: string
    readonly name: string
    readonly version: string
    readonly description: string
    readonly status: AgentStatus
    readonly permissions: readonly string[]
    readonly author: string
    readonly icon?: string
    readonly category?: string
    readonly tags?: readonly string[]
    readonly createdAt: string
    readonly updatedAt?: string
}

// ─── Agent Run DTO ──────────────────────────────────────────────────────────

export interface IAgentRunDTO {
    readonly runId: string
    readonly agentId: string
    readonly agentType: string
    readonly goal: string
    readonly status: 'queued' | 'running' | 'completed' | 'failed'
    readonly steps: number
    readonly result?: Record<string, unknown>
    readonly startedAt: string
    readonly completedAt?: string
}

// ─── Agent Run Result DTO ───────────────────────────────────────────────────

export interface IAgentRunResultDTO {
    readonly runId: string
    readonly status: 'completed' | 'failed'
    readonly steps: number
    readonly result?: Record<string, unknown>
    readonly completedAt: string
}

// ─── Agent Device DTO ───────────────────────────────────────────────────────

export interface IAgentDeviceDTO {
    readonly id: string
    readonly name: string
    readonly platform: string
    readonly version: string
    readonly status: 'online' | 'offline'
}

// ─── Agent Metrics DTO ──────────────────────────────────────────────────────

export interface IAgentMetricsDTO {
    readonly cpuPercent: number
    readonly memPercent: number
    readonly uptimeSeconds: number
    readonly tasksCompleted: number
}

// ─── Agent Config DTO ───────────────────────────────────────────────────────

export interface IAgentConfigDTO {
    readonly agentId: string
    readonly model: string
    readonly temperature: number
    readonly maxTokens: number
    readonly systemPrompt: string
    readonly tools: readonly string[]
}
