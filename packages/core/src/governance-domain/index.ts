/**
 * GovernanceDomain — core ports for policy enforcement, budget tracking,
 * rate limiting, and model registry.
 *
 * These ports are implemented by the governance package (infrastructure layer).
 * Execution engine depends on these ports to enforce policies BEFORE planning.
 */

// ─── Policy Types ───────────────────────────────────────────────────────────

export interface IPolicyViolation {
    readonly code: string
    readonly message: string
    readonly severity: 'error' | 'warning'
    readonly field?: string
    readonly metadata?: Readonly<Record<string, unknown>>
}

export interface IPolicyEvaluationResult {
    readonly allowed: boolean
    readonly violations: readonly IPolicyViolation[]
    readonly evaluatedAt: string
}

export interface IPolicyRule {
    readonly id: string
    readonly name: string
    readonly description: string
    readonly enabled: boolean
    readonly priority: number
    evaluate(context: IPolicyContext): IPolicyEvaluationResult
}

export interface IPolicyContext {
    readonly agentId: string
    readonly workspaceId: string
    readonly executionInput: Readonly<Record<string, unknown>>
    readonly agentCapabilities: readonly string[]
    readonly agentPermissions: readonly string[]
    readonly model?: string
    readonly maxTokenBudget?: number
    readonly timestamp: string
}

// ─── Policy Engine Port ─────────────────────────────────────────────────────

export interface IPolicyEnginePort {
    evaluate(context: IPolicyContext): Promise<IPolicyEvaluationResult>
    addRule(rule: IPolicyRule): void
    removeRule(ruleId: string): void
    listRules(): readonly IPolicyRule[]
    enableRule(ruleId: string): void
    disableRule(ruleId: string): void
}

// ─── Budget Types ───────────────────────────────────────────────────────────

export interface IBudgetRecord {
    readonly agentId: string
    readonly workspaceId: string
    readonly totalTokensUsed: number
    readonly totalCostUsd: number
    readonly budgetLimit: number
    readonly periodStart: string
    readonly periodEnd: string
}

export interface IBudgetCheckResult {
    readonly allowed: boolean
    readonly remainingTokens: number
    readonly totalUsed: number
    readonly budgetLimit: number
    readonly estimatedCost: number
}

// ─── Budget Manager Port ────────────────────────────────────────────────────

export interface IBudgetManagerPort {
    check(agentId: string, workspaceId: string, estimatedTokens: number): Promise<IBudgetCheckResult>
    record(agentId: string, workspaceId: string, tokensUsed: number, costUsd: number): Promise<void>
    getBudget(agentId: string, workspaceId: string): Promise<IBudgetRecord | null>
    setBudgetLimit(agentId: string, workspaceId: string, limit: number): Promise<void>
    resetBudget(agentId: string, workspaceId: string): Promise<void>
}

// ─── Rate Limit Types ───────────────────────────────────────────────────────

export interface IRateLimitConfig {
    readonly maxRequestsPerMinute: number
    readonly maxRequestsPerHour: number
    readonly maxConcurrentExecutions: number
}

export interface IRateLimitCheckResult {
    readonly allowed: boolean
    readonly retryAfterMs: number
    readonly currentCount: number
    readonly limit: number
    readonly windowType: 'minute' | 'hour' | 'concurrent'
}

// ─── Rate Limiter Port ──────────────────────────────────────────────────────

export interface IRateLimiterPort {
    check(agentId: string, workspaceId: string): Promise<IRateLimitCheckResult>
    record(agentId: string, workspaceId: string): Promise<void>
    release(agentId: string, workspaceId: string): Promise<void>
    getConfig(agentId: string): Promise<IRateLimitConfig>
    setConfig(agentId: string, config: IRateLimitConfig): Promise<void>
}

// ─── Model Registry Types ───────────────────────────────────────────────────

export type ModelStatus = 'allowed' | 'denied' | 'deprecated'

export interface IModelRegistryEntry {
    readonly modelId: string
    readonly provider: string
    readonly status: ModelStatus
    readonly maxTokens: number
    readonly costPerInputToken: number
    readonly costPerOutputToken: number
    readonly capabilities: readonly string[]
    readonly deprecated?: boolean
    readonly replacedBy?: string
}

// ─── Model Registry Port ────────────────────────────────────────────────────

export interface IModelRegistryPort {
    isAllowed(modelId: string, workspaceId: string): Promise<boolean>
    getModel(modelId: string): Promise<IModelRegistryEntry | null>
    listModels(workspaceId: string): Promise<readonly IModelRegistryEntry[]>
    allowModel(modelId: string, workspaceId: string): Promise<void>
    denyModel(modelId: string, workspaceId: string): Promise<void>
    registerModel(entry: IModelRegistryEntry): Promise<void>
    getDefaultModel(workspaceId: string): Promise<string | null>
    setDefaultModel(modelId: string, workspaceId: string): Promise<void>
}

// ─── Workspace Policy ───────────────────────────────────────────────────────

export interface IWorkspacePolicy {
    readonly workspaceId: string
    readonly maxTokenBudgetPerAgent: number
    readonly maxConcurrentExecutions: number
    readonly allowedModels: readonly string[]
    readonly deniedModels: readonly string[]
    readonly rateLimitConfig: IRateLimitConfig
    readonly requireApprovalForDangerousPermissions: boolean
    readonly updatedAt: string
}
