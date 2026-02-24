/**
 * Platform v2 IPC Contracts — typed channels and payloads for new platform features.
 *
 * Extends desktop-ipc.ts with channels for:
 * - Policy violations and governance
 * - Test execution
 * - Plugin management
 * - Workspace switching
 */

import type { GovernanceDomain, WorkspaceDomain, PluginDomain, ObservabilityDomain } from '@agenthub/core'

// ─── Extended IPC Channel Names ─────────────────────────────────────────────

export type PlatformIPCChannel =
    // Governance
    | 'governance:evaluate-policy'
    | 'governance:get-violations'
    | 'governance:get-budget'
    | 'governance:set-budget'
    | 'governance:get-rate-limit'
    | 'governance:set-rate-limit'
    | 'governance:list-models'
    | 'governance:allow-model'
    | 'governance:deny-model'
    // Plugin management
    | 'plugin:install'
    | 'plugin:uninstall'
    | 'plugin:activate'
    | 'plugin:deactivate'
    | 'plugin:list'
    | 'plugin:get'
    // Workspace management
    | 'workspace:create'
    | 'workspace:delete'
    | 'workspace:list'
    | 'workspace:get'
    | 'workspace:switch'
    | 'workspace:get-current'
    // Test execution
    | 'test:run-scenario'
    | 'test:run-all'
    | 'test:list-scenarios'
    | 'test:get-results'
    // Observability
    | 'observability:get-trace'
    | 'observability:list-traces'
    | 'observability:get-metrics'
    | 'observability:get-logs'

// ─── Governance IPC Payloads ────────────────────────────────────────────────

export interface IPolicyEvaluatePayload {
    readonly agentId: string
    readonly workspaceId: string
    readonly input: Record<string, unknown>
    readonly model?: string
}

export interface IPolicyEvaluateResult {
    readonly allowed: boolean
    readonly violations: readonly {
        readonly code: string
        readonly message: string
        readonly severity: 'error' | 'warning'
    }[]
    readonly evaluatedAt: string
}

export interface IBudgetPayload {
    readonly agentId: string
    readonly workspaceId: string
}

export interface IBudgetResult {
    readonly totalTokensUsed: number
    readonly budgetLimit: number
    readonly remainingTokens: number
    readonly totalCostUsd: number
}

export interface ISetBudgetPayload {
    readonly agentId: string
    readonly workspaceId: string
    readonly limit: number
}

export interface IRateLimitPayload {
    readonly agentId: string
    readonly workspaceId: string
}

export interface ISetRateLimitPayload {
    readonly agentId: string
    readonly maxRequestsPerMinute: number
    readonly maxRequestsPerHour: number
    readonly maxConcurrentExecutions: number
}

export interface IModelListResult {
    readonly models: readonly {
        readonly modelId: string
        readonly provider: string
        readonly status: 'allowed' | 'denied' | 'deprecated'
        readonly maxTokens: number
    }[]
}

export interface IModelActionPayload {
    readonly modelId: string
    readonly workspaceId: string
}

// ─── Plugin IPC Payloads ────────────────────────────────────────────────────

export interface IPluginInstallPayload {
    readonly pluginPath: string
}

export interface IPluginActionPayload {
    readonly pluginId: string
}

export interface IPluginListResult {
    readonly plugins: readonly {
        readonly id: string
        readonly name: string
        readonly version: string
        readonly status: string
        readonly description: string
        readonly author?: string
    }[]
}

export interface IPluginDetailResult {
    readonly id: string
    readonly name: string
    readonly version: string
    readonly description: string
    readonly status: string
    readonly permissions: readonly string[]
    readonly tools: readonly { readonly name: string; readonly description: string }[]
    readonly skills: readonly { readonly name: string; readonly description: string }[]
}

// ─── Workspace IPC Payloads ─────────────────────────────────────────────────

export interface IWorkspaceCreatePayload {
    readonly name: string
}

export interface IWorkspaceActionPayload {
    readonly workspaceId: string
}

export interface IWorkspaceResult {
    readonly id: string
    readonly name: string
    readonly isDefault: boolean
    readonly createdAt: string
    readonly updatedAt: string
}

export interface IWorkspaceListResult {
    readonly workspaces: readonly IWorkspaceResult[]
    readonly currentWorkspaceId: string
}

// ─── Test IPC Payloads ──────────────────────────────────────────────────────

export interface ITestRunPayload {
    readonly scenarioId: string
    readonly workspaceId: string
}

export interface ITestRunAllPayload {
    readonly workspaceId: string
    readonly agentId?: string
}

export interface ITestResultDTO {
    readonly scenarioId: string
    readonly scenarioName: string
    readonly passed: boolean
    readonly diff?: string
    readonly tokenUsage: number
    readonly latency: number
    readonly error?: string
    readonly executedAt: string
}

export interface ITestRunResult {
    readonly results: readonly ITestResultDTO[]
    readonly totalPassed: number
    readonly totalFailed: number
    readonly totalDuration: number
}

// ─── Observability IPC Payloads ─────────────────────────────────────────────

export interface ITraceQueryPayload {
    readonly traceId?: string
    readonly workspaceId: string
    readonly limit?: number
}

export interface IMetricsQueryPayload {
    readonly name?: string
    readonly executionId?: string
    readonly limit?: number
}

export interface ILogsQueryPayload {
    readonly level?: string
    readonly context?: string
    readonly traceId?: string
    readonly executionId?: string
    readonly limit?: number
}

// ─── Extended Execution Events ──────────────────────────────────────────────

export type PlatformExecutionEvent =
    | { readonly type: 'ExecutionRejected'; readonly executionId: string; readonly agentId: string; readonly violations: readonly { readonly code: string; readonly message: string }[]; readonly timestamp: string }
    | { readonly type: 'PolicyEvaluated'; readonly executionId: string; readonly allowed: boolean; readonly violationCount: number; readonly timestamp: string }
    | { readonly type: 'BudgetChecked'; readonly executionId: string; readonly remainingTokens: number; readonly timestamp: string }
    | { readonly type: 'RateLimitChecked'; readonly executionId: string; readonly allowed: boolean; readonly timestamp: string }
    | { readonly type: 'TraceStarted'; readonly executionId: string; readonly traceId: string; readonly timestamp: string }
    | { readonly type: 'TraceCompleted'; readonly executionId: string; readonly traceId: string; readonly status: string; readonly timestamp: string }
