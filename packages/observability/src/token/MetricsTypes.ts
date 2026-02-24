/**
 * MetricsTypes — strongly-typed domain types for token monitoring and cost analytics.
 *
 * Lives in packages/observability. No UI code. No infrastructure dependencies.
 */

export interface TokenUsageRecord {
    readonly executionId: string
    readonly workspaceId: string
    readonly agentId: string
    readonly phase: 'planning' | 'execution' | 'micro'
    readonly model: string
    readonly promptTokens: number
    readonly completionTokens: number
    readonly totalTokens: number
    readonly timestamp: number
}

export interface ToolUsageRecord {
    readonly executionId: string
    readonly workspaceId: string
    readonly agentId: string
    readonly toolName: string
    readonly durationMs: number
    readonly timestamp: number
}

export interface AgentCostSummary {
    readonly agentId: string
    readonly tokens: number
    readonly cost: number
    readonly promptTokens: number
    readonly completionTokens: number
}

export interface ExecutionCostSummary {
    readonly executionId: string
    readonly workspaceId: string
    readonly totalTokens: number
    readonly totalCost: number
    readonly promptTokens: number
    readonly completionTokens: number
    readonly agents: readonly AgentCostSummary[]
    readonly toolCalls: number
    readonly phases: PhaseCostBreakdown
    readonly model: string
    readonly timestamp: number
}

export interface PhaseCostBreakdown {
    readonly planning: PhaseTokens
    readonly execution: PhaseTokens
    readonly micro: PhaseTokens
}

export interface PhaseTokens {
    readonly tokens: number
    readonly cost: number
}

export interface DailyUsageSummary {
    readonly date: string
    readonly totalTokens: number
    readonly totalCost: number
    readonly promptTokens: number
    readonly completionTokens: number
    readonly executionCount: number
    readonly agents: readonly AgentCostSummary[]
    readonly models: readonly ModelUsageSummary[]
    readonly toolCalls: number
}

export interface ModelUsageSummary {
    readonly model: string
    readonly promptTokens: number
    readonly completionTokens: number
    readonly totalTokens: number
    readonly cost: number
}

export interface AgentBreakdown {
    readonly date: string
    readonly agents: readonly AgentDetailedBreakdown[]
}

export interface AgentDetailedBreakdown {
    readonly agentId: string
    readonly totalTokens: number
    readonly totalCost: number
    readonly executionCount: number
    readonly averageTokensPerExecution: number
    readonly planningTokens: number
    readonly executionTokens: number
    readonly microTokens: number
}

export interface MetricsExportReport {
    readonly generatedAt: string
    readonly dateRange: { readonly from: string; readonly to: string }
    readonly totalTokens: number
    readonly totalCost: number
    readonly dailySummaries: readonly DailyUsageSummary[]
    readonly topAgents: readonly AgentCostSummary[]
    readonly topModels: readonly ModelUsageSummary[]
}

export interface IMetricsStore {
    appendTokenUsage(record: TokenUsageRecord): Promise<void>
    appendToolUsage(record: ToolUsageRecord): Promise<void>
    getTokenRecords(executionId: string): Promise<readonly TokenUsageRecord[]>
    getToolRecords(executionId: string): Promise<readonly ToolUsageRecord[]>
    getDailyTokenRecords(date: string): Promise<readonly TokenUsageRecord[]>
    getDailyToolRecords(date: string): Promise<readonly ToolUsageRecord[]>
    getAllExecutionIds(): Promise<readonly string[]>
    getExecutionRecords(executionId: string): Promise<{
        readonly tokens: readonly TokenUsageRecord[]
        readonly tools: readonly ToolUsageRecord[]
    }>
}
