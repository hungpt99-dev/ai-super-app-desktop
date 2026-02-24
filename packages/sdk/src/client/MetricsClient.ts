/**
 * MetricsClient — SDK layer for metrics operations.
 *
 * Uses transport abstraction. Never uses Tauri directly.
 * Renderer imports this via @agenthub/sdk.
 */

export interface IMetricsTransport {
    invoke<T>(channel: string, payload?: unknown): Promise<T>
}

export interface IExecutionCostSummaryDTO {
    readonly executionId: string
    readonly workspaceId: string
    readonly totalTokens: number
    readonly totalCost: number
    readonly promptTokens: number
    readonly completionTokens: number
    readonly agents: readonly { readonly agentId: string; readonly tokens: number; readonly cost: number; readonly promptTokens: number; readonly completionTokens: number }[]
    readonly toolCalls: number
    readonly phases: {
        readonly planning: { readonly tokens: number; readonly cost: number }
        readonly execution: { readonly tokens: number; readonly cost: number }
        readonly micro: { readonly tokens: number; readonly cost: number }
    }
    readonly model: string
    readonly timestamp: number
}

export interface IDailyUsageSummaryDTO {
    readonly date: string
    readonly totalTokens: number
    readonly totalCost: number
    readonly promptTokens: number
    readonly completionTokens: number
    readonly executionCount: number
    readonly agents: readonly { readonly agentId: string; readonly tokens: number; readonly cost: number; readonly promptTokens: number; readonly completionTokens: number }[]
    readonly models: readonly { readonly model: string; readonly promptTokens: number; readonly completionTokens: number; readonly totalTokens: number; readonly cost: number }[]
    readonly toolCalls: number
}

export interface IAgentBreakdownDTO {
    readonly date: string
    readonly agents: readonly {
        readonly agentId: string
        readonly totalTokens: number
        readonly totalCost: number
        readonly executionCount: number
        readonly averageTokensPerExecution: number
        readonly planningTokens: number
        readonly executionTokens: number
        readonly microTokens: number
    }[]
}

export interface IMetricsExportReportDTO {
    readonly generatedAt: string
    readonly dateRange: { readonly from: string; readonly to: string }
    readonly totalTokens: number
    readonly totalCost: number
    readonly dailySummaries: readonly IDailyUsageSummaryDTO[]
    readonly topAgents: readonly { readonly agentId: string; readonly tokens: number; readonly cost: number; readonly promptTokens: number; readonly completionTokens: number }[]
    readonly topModels: readonly { readonly model: string; readonly promptTokens: number; readonly completionTokens: number; readonly totalTokens: number; readonly cost: number }[]
}

export interface IMetricsClient {
    getExecutionSummary(executionId: string): Promise<IExecutionCostSummaryDTO>
    getDailyUsage(date: string): Promise<IDailyUsageSummaryDTO>
    getAgentBreakdown(date: string): Promise<IAgentBreakdownDTO>
    getAllExecutions(): Promise<readonly string[]>
    exportReport(fromDate: string, toDate: string): Promise<IMetricsExportReportDTO>
}

export class MetricsClient implements IMetricsClient {
    private readonly transport: IMetricsTransport

    constructor(transport: IMetricsTransport) {
        this.transport = transport
    }

    async getExecutionSummary(executionId: string): Promise<IExecutionCostSummaryDTO> {
        return this.transport.invoke<IExecutionCostSummaryDTO>('metrics:getExecutionSummary', { executionId })
    }

    async getDailyUsage(date: string): Promise<IDailyUsageSummaryDTO> {
        return this.transport.invoke<IDailyUsageSummaryDTO>('metrics:getDailyUsage', { date })
    }

    async getAgentBreakdown(date: string): Promise<IAgentBreakdownDTO> {
        return this.transport.invoke<IAgentBreakdownDTO>('metrics:getAgentBreakdown', { date })
    }

    async getAllExecutions(): Promise<readonly string[]> {
        return this.transport.invoke<readonly string[]>('metrics:getAllExecutions', {})
    }

    async exportReport(fromDate: string, toDate: string): Promise<IMetricsExportReportDTO> {
        return this.transport.invoke<IMetricsExportReportDTO>('metrics:exportReport', { fromDate, toDate })
    }
}
