/**
 * Metrics IPC Handler — handles metrics:* channels for token monitoring.
 *
 * Channels:
 * - metrics:getExecutionSummary
 * - metrics:getDailyUsage
 * - metrics:getAgentBreakdown
 * - metrics:getAllExecutions
 * - metrics:exportReport
 * - metrics:getSummary
 * - metrics:getTokens
 * - metrics:getCosts
 * - metrics:getAgents
 * - metrics:getExecutions
 * - metrics:getTools
 * - metrics:getModels
 * - metrics:export
 *
 * Main process only. Dispatches to TokenTracker via FileMetricsStore.
 */

import { TokenTracker } from '@agenthub/observability'
import type {
    ExecutionCostSummary,
    DailyUsageSummary,
    AgentBreakdown,
    MetricsExportReport,
} from '@agenthub/observability'
import { FileMetricsStore } from '@agenthub/infrastructure/node'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: any = new FileMetricsStore()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tracker: any = new TokenTracker(store)

// ─── Comprehensive Metrics Types for Dashboard ─────────────────────────────────────

export interface IMetricsSummary {
    readonly tokensToday: number
    readonly tokensThisWeek: number
    readonly tokensThisMonth: number
    readonly costToday: number
    readonly costMonth: number
    readonly activeAgents: number
    readonly executionsToday: number
    readonly avgTokensPerTask: number
    readonly avgCostPerTask: number
    readonly toolCallsToday: number
}

export interface ITokenAnalyticsData {
    readonly tokensPerDay: readonly { readonly date: string; readonly tokens: number }[]
    readonly tokensPerAgent: readonly { readonly agentId: string; readonly tokens: number }[]
    readonly tokensPerModel: readonly { readonly model: string; readonly tokens: number }[]
    readonly tokensPerExecution: readonly { readonly executionId: string; readonly tokens: number }[]
    readonly planningVsExecution: readonly { readonly planning: number; readonly execution: number; readonly micro: number }[]
}

export interface ICostAnalyticsData {
    readonly costPerAgent: readonly { readonly agentId: string; readonly cost: number }[]
    readonly costPerModel: readonly { readonly model: string; readonly cost: number }[]
    readonly costPerDay: readonly { readonly date: string; readonly cost: number }[]
    readonly costPerExecution: readonly { readonly executionId: string; readonly cost: number }[]
    readonly topExpensiveExecutions: readonly { readonly executionId: string; readonly cost: number }[]
}

export interface IAgentAnalyticsData {
    readonly agents: readonly {
        readonly agentId: string
        readonly executions: number
        readonly totalTokens: number
        readonly totalCost: number
        readonly avgTokens: number
        readonly successRate: number
        readonly lastActive: string
        readonly efficiencyScore: number
    }[]
}

export interface IPlanningAnalyticsData {
    readonly planningTokens: number
    readonly executionTokens: number
    readonly microTokens: number
    readonly planningRatio: number
    readonly microPlanRatio: number
    readonly dailyPlanning: readonly { readonly date: string; readonly planning: number; readonly execution: number; readonly micro: number }[]
}

export interface IToolAnalyticsData {
    readonly toolUsageFrequency: readonly { readonly toolName: string; readonly count: number }[]
    readonly toolTokenCost: readonly { readonly toolName: string; readonly cost: number }[]
    readonly toolExecutionTime: readonly { readonly toolName: string; readonly avgDurationMs: number }[]
}

export interface IModelAnalyticsData {
    readonly modelUsage: readonly { readonly model: string; readonly count: number }[]
    readonly modelCost: readonly { readonly model: string; readonly cost: number }[]
    readonly modelTokens: readonly { readonly model: string; readonly tokens: number }[]
}

export interface IExecutionAnalyticsData {
    readonly executions: readonly {
        readonly executionId: string
        readonly agent: string
        readonly tokens: number
        readonly cost: number
        readonly duration: number
        readonly toolsUsed: readonly string[]
        readonly status: 'completed' | 'failed' | 'active'
    }[]
}

export interface IEfficiencyWarning {
    readonly type: 'planning_tokens' | 'micro_plans' | 'tool_calls' | 'expensive_agent' | 'expensive_model'
    readonly severity: 'warning' | 'critical'
    readonly message: string
    readonly details: string
}

export interface IMetricsFilters {
    readonly fromDate: string
    readonly toDate: string
    readonly agentId?: string
    readonly model?: string
    readonly workspaceId?: string
}

export interface IMetricsGetExecutionPayload {
    readonly executionId: string
}

export interface IMetricsGetDailyPayload {
    readonly date: string
}

export interface IMetricsGetAgentBreakdownPayload {
    readonly date: string
}

export interface IMetricsExportPayload {
    readonly fromDate: string
    readonly toDate: string
}

// Helper to format date
function formatDateStr(d: Date): string {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

// Get date N days ago
function getDaysAgo(days: number): Date {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d
}

export const metricsIPC = {
    async getExecutionSummary(payload: IMetricsGetExecutionPayload): Promise<ExecutionCostSummary> {
        return tracker.getExecutionSummary(payload.executionId)
    },

    async getDailyUsage(payload: IMetricsGetDailyPayload): Promise<DailyUsageSummary> {
        return tracker.getDailyUsage(payload.date)
    },

    async getAgentBreakdown(payload: IMetricsGetAgentBreakdownPayload): Promise<AgentBreakdown> {
        return tracker.getAgentBreakdown(payload.date)
    },

    async getAllExecutions(): Promise<readonly string[]> {
        const result = await store.getAllExecutionIds()
        return result
    },

    async exportReport(payload: IMetricsExportPayload): Promise<MetricsExportReport> {
        const fromMs = new Date(payload.fromDate).getTime()
        const toMs = new Date(payload.toDate).getTime()
        const dailySummaries: DailyUsageSummary[] = []

        let currentMs = fromMs
        while (currentMs <= toMs) {
            const d = new Date(currentMs)
            const dateStr = formatDateStr(d)
            const summary = await tracker.getDailyUsage(dateStr)
            if (summary.totalTokens > 0) {
                dailySummaries.push(summary)
            }
            currentMs += 86_400_000
        }

        let totalTokens = 0
        let totalCost = 0
        const agentMap = new Map<string, { tokens: number; cost: number; prompt: number; completion: number }>()
        const modelMap = new Map<string, { prompt: number; completion: number; cost: number }>()

        for (const ds of dailySummaries) {
            totalTokens += ds.totalTokens
            totalCost += ds.totalCost
            for (const a of ds.agents) {
                const existing = agentMap.get(a.agentId)
                if (existing) {
                    existing.tokens += a.tokens
                    existing.cost += a.cost
                    existing.prompt += a.promptTokens
                    existing.completion += a.completionTokens
                } else {
                    agentMap.set(a.agentId, { tokens: a.tokens, cost: a.cost, prompt: a.promptTokens, completion: a.completionTokens })
                }
            }
            for (const m of ds.models) {
                const existing = modelMap.get(m.model)
                if (existing) {
                    existing.prompt += m.promptTokens
                    existing.completion += m.completionTokens
                    existing.cost += m.cost
                } else {
                    modelMap.set(m.model, { prompt: m.promptTokens, completion: m.completionTokens, cost: m.cost })
                }
            }
        }

        const topAgents = Array.from(agentMap.entries())
            .map(([agentId, d]) => ({ agentId, tokens: d.tokens, cost: Math.round(d.cost * 1_000_000) / 1_000_000, promptTokens: d.prompt, completionTokens: d.completion }))
            .sort((a, b) => b.tokens - a.tokens)

        const topModels = Array.from(modelMap.entries())
            .map(([model, d]) => ({ model, promptTokens: d.prompt, completionTokens: d.completion, totalTokens: d.prompt + d.completion, cost: Math.round(d.cost * 1_000_000) / 1_000_000 }))
            .sort((a, b) => b.totalTokens - a.totalTokens)

        return {
            generatedAt: new Date().toISOString(),
            dateRange: { from: payload.fromDate, to: payload.toDate },
            totalTokens,
            totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
            dailySummaries,
            topAgents,
            topModels,
        }
    },

    // ─── New Dashboard IPC Methods ───────────────────────────────────────────────

    async getSummary(_payload: IMetricsFilters): Promise<IMetricsSummary> {
        const today = formatDateStr(new Date())
        const weekAgo = formatDateStr(getDaysAgo(7))
        const monthAgo = formatDateStr(getDaysAgo(30))

        // Get today's data
        const todayData = await tracker.getDailyUsage(today).catch(() => ({
            totalTokens: 0,
            totalCost: 0,
            executionCount: 0,
            toolCalls: 0,
            agents: [],
            models: [],
        }))

        // Get week data
        let weekTokens = 0
        let weekCost = 0
        let weekExecutions = 0
        const weekAgents = new Set<string>()

        for (let i = 0; i < 7; i++) {
            const date = formatDateStr(getDaysAgo(i))
            const data = await tracker.getDailyUsage(date).catch(() => ({
                totalTokens: 0,
                totalCost: 0,
                executionCount: 0,
                agents: [],
            }))
            weekTokens += data.totalTokens
            weekCost += data.totalCost
            weekExecutions += data.executionCount
            for (const agent of data.agents) {
                weekAgents.add(agent.agentId)
            }
        }

        // Get month data
        let monthTokens = 0
        let monthCost = 0

        for (let i = 0; i < 30; i++) {
            const date = formatDateStr(getDaysAgo(i))
            const data = await tracker.getDailyUsage(date).catch(() => ({
                totalTokens: 0,
                totalCost: 0,
            }))
            monthTokens += data.totalTokens
            monthCost += data.totalCost
        }

        return {
            tokensToday: todayData.totalTokens,
            tokensThisWeek: weekTokens,
            tokensThisMonth: monthTokens,
            costToday: todayData.totalCost,
            costMonth: monthCost,
            activeAgents: weekAgents.size,
            executionsToday: todayData.executionCount,
            avgTokensPerTask: todayData.executionCount > 0 ? Math.round(todayData.totalTokens / todayData.executionCount) : 0,
            avgCostPerTask: todayData.executionCount > 0 ? Math.round((todayData.totalCost / todayData.executionCount) * 1_000_000) / 1_000_000 : 0,
            toolCallsToday: todayData.toolCalls,
        }
    },

    async getTokens(_payload: IMetricsFilters): Promise<ITokenAnalyticsData> {
        const tokensPerDay: { date: string; tokens: number }[] = []
        const tokensPerAgent: { agentId: string; tokens: number }[] = []
        const tokensPerModel: { model: string; tokens: number }[] = []
        const tokensPerExecution: { executionId: string; tokens: number }[] = []
        const planningVsExecution: { planning: number; execution: number; micro: number }[] = []

        // Get last 7 days
        for (let i = 0; i < 7; i++) {
            const date = formatDateStr(getDaysAgo(i))
            const data = await tracker.getDailyUsage(date).catch(() => ({
                totalTokens: 0,
                agents: [],
                models: [],
            }))
            tokensPerDay.push({ date, tokens: data.totalTokens })

            // Aggregations
            for (const agent of data.agents) {
                tokensPerAgent.push({ agentId: agent.agentId, tokens: agent.tokens })
            }
            for (const model of data.models) {
                tokensPerModel.push({ model: model.model, tokens: model.totalTokens })
            }
        }

        // Get execution summaries
        const execIds = await store.getAllExecutionIds()
        const recentExecs = execIds.slice(-50)
        for (const execId of recentExecs) {
            const summary = await tracker.getExecutionSummary(execId).catch(() => ({
                totalTokens: 0,
                phases: { planning: { tokens: 0 }, execution: { tokens: 0 }, micro: { tokens: 0 } },
            }))
            tokensPerExecution.push({ executionId: execId, tokens: summary.totalTokens })
            planningVsExecution.push({
                planning: summary.phases?.planning?.tokens ?? 0,
                execution: summary.phases?.execution?.tokens ?? 0,
                micro: summary.phases?.micro?.tokens ?? 0,
            })
        }

        return {
            tokensPerDay,
            tokensPerAgent: aggregateByKey(tokensPerAgent, 'agentId', 'tokens'),
            tokensPerModel: aggregateByKey(tokensPerModel, 'model', 'tokens'),
            tokensPerExecution,
            planningVsExecution,
        }
    },

    async getCosts(_payload: IMetricsFilters): Promise<ICostAnalyticsData> {
        const costPerAgent: { agentId: string; cost: number }[] = []
        const costPerModel: { model: string; cost: number }[] = []
        const costPerDay: { date: string; cost: number }[] = []
        const costPerExecution: { executionId: string; cost: number }[] = []
        const topExpensiveExecutions: { executionId: string; cost: number }[] = []

        // Get last 7 days
        for (let i = 0; i < 7; i++) {
            const date = formatDateStr(getDaysAgo(i))
            const data = await tracker.getDailyUsage(date).catch(() => ({
                totalCost: 0,
                agents: [],
                models: [],
            }))
            costPerDay.push({ date, cost: data.totalCost })

            for (const agent of data.agents) {
                costPerAgent.push({ agentId: agent.agentId, cost: agent.cost })
            }
            for (const model of data.models) {
                costPerModel.push({ model: model.model, cost: model.cost })
            }
        }

        // Get execution summaries
        const execIds = await store.getAllExecutionIds()
        const recentExecs = execIds.slice(-50)
        for (const execId of recentExecs) {
            const summary = await tracker.getExecutionSummary(execId).catch(() => ({
                totalCost: 0,
            }))
            costPerExecution.push({ executionId: execId, cost: summary.totalCost })
            topExpensiveExecutions.push({ executionId: execId, cost: summary.totalCost })
        }

        // Sort and get top expensive
        topExpensiveExecutions.sort((a, b) => b.cost - a.cost)

        return {
            costPerAgent: aggregateByKey(costPerAgent, 'agentId', 'cost'),
            costPerModel: aggregateByKey(costPerModel, 'model', 'cost'),
            costPerDay,
            costPerExecution,
            topExpensiveExecutions: topExpensiveExecutions.slice(0, 10),
        }
    },

    async getAgents(_payload: IMetricsFilters): Promise<IAgentAnalyticsData> {
        const agentMap = new Map<string, {
            executions: number
            totalTokens: number
            totalCost: number
            lastActive: number
            successfulExecutions: number
        }>()

        // Get last 7 days
        for (let i = 0; i < 7; i++) {
            const date = formatDateStr(getDaysAgo(i))
            const data = await tracker.getDailyUsage(date).catch(() => ({
                agents: [],
            }))

            for (const agent of data.agents) {
                const existing = agentMap.get(agent.agentId) ?? {
                    executions: 0,
                    totalTokens: 0,
                    totalCost: 0,
                    lastActive: 0,
                    successfulExecutions: 0,
                }
                existing.executions += 1
                existing.totalTokens += agent.tokens
                existing.totalCost += agent.cost
                existing.lastActive = Math.max(existing.lastActive, new Date(date).getTime())
                // Assume 80% success rate as we don't track failures directly
                existing.successfulExecutions = Math.floor(existing.executions * 0.8)
                agentMap.set(agent.agentId, existing)
            }
        }

        const agents = Array.from(agentMap.entries()).map(([agentId, data]) => ({
            agentId,
            executions: data.executions,
            totalTokens: data.totalTokens,
            totalCost: Math.round(data.totalCost * 1_000_000) / 1_000_000,
            avgTokens: data.executions > 0 ? Math.round(data.totalTokens / data.executions) : 0,
            successRate: data.executions > 0 ? Math.round((data.successfulExecutions / data.executions) * 100) : 0,
            lastActive: data.lastActive > 0 ? new Date(data.lastActive).toISOString() : '',
            efficiencyScore: data.totalTokens > 0
                ? Math.round((data.successfulExecutions / data.totalTokens) * 1_000_000)
                : 0,
        }))

        return { agents }
    },

    async getExecutions(_payload: IMetricsFilters): Promise<IExecutionAnalyticsData> {
        const execIds = await store.getAllExecutionIds()
        const recentExecs = execIds.slice(-100).reverse() // Most recent first

        const executions = await Promise.all(
            recentExecs.slice(0, 50).map(async (execId) => {
                const summary = await tracker.getExecutionSummary(execId).catch(() => ({
                    executionId: execId,
                    totalTokens: 0,
                    totalCost: 0,
                    toolCalls: 0,
                    timestamp: Date.now(),
                    phases: { planning: { tokens: 0 }, execution: { tokens: 0 }, micro: { tokens: 0 } },
                    agents: [],
                }))

                const tools = await store.getToolRecords(execId).catch(() => [])

                return {
                    executionId: execId,
                    agent: summary.agents?.[0]?.agentId ?? 'unknown',
                    tokens: summary.totalTokens,
                    cost: summary.totalCost,
                    duration: 0, // Would need to calculate from timestamps
                    toolsUsed: tools.map((t: any) => t.toolName).slice(0, 5),
                    status: 'completed' as const,
                }
            })
        )

        return { executions }
    },

    async getTools(_payload: IMetricsFilters): Promise<IToolAnalyticsData> {
        const toolCount = new Map<string, number>()
        const toolCost = new Map<string, number>()
        const toolDuration = new Map<string, { total: number; count: number }>()

        // Get last 7 days
        for (let i = 0; i < 7; i++) {
            const date = formatDateStr(getDaysAgo(i))
            const toolRecords = await store.getDailyToolRecords(date).catch(() => [])

            for (const record of toolRecords) {
                const name = record.toolName
                toolCount.set(name, (toolCount.get(name) ?? 0) + 1)

                // Estimate cost based on duration (rough approximation)
                const estimatedCost = record.durationMs / 1000 * 0.001
                toolCost.set(name, (toolCost.get(name) ?? 0) + estimatedCost)

                const existing = toolDuration.get(name) ?? { total: 0, count: 0 }
                existing.total += record.durationMs
                existing.count += 1
                toolDuration.set(name, existing)
            }
        }

        const toolUsageFrequency = Array.from(toolCount.entries())
            .map(([toolName, count]) => ({ toolName, count }))
            .sort((a, b) => b.count - a.count)

        const toolTokenCost = Array.from(toolCost.entries())
            .map(([toolName, cost]) => ({ toolName, cost: Math.round(cost * 1_000_000) / 1_000_000 }))
            .sort((a, b) => b.cost - a.cost)

        const toolExecutionTime = Array.from(toolDuration.entries())
            .map(([toolName, data]) => ({ toolName, avgDurationMs: Math.round(data.total / data.count) }))
            .sort((a, b) => b.avgDurationMs - a.avgDurationMs)

        return { toolUsageFrequency, toolTokenCost, toolExecutionTime }
    },

    async getModels(_payload: IMetricsFilters): Promise<IModelAnalyticsData> {
        const modelUsage = new Map<string, number>()
        const modelCost = new Map<string, number>()
        const modelTokens = new Map<string, number>()

        // Get last 7 days
        for (let i = 0; i < 7; i++) {
            const date = formatDateStr(getDaysAgo(i))
            const data = await tracker.getDailyUsage(date).catch(() => ({
                models: [],
            }))

            for (const model of data.models) {
                modelUsage.set(model.model, (modelUsage.get(model.model) ?? 0) + 1)
                modelCost.set(model.model, (modelCost.get(model.model) ?? 0) + model.cost)
                modelTokens.set(model.model, (modelTokens.get(model.model) ?? 0) + model.totalTokens)
            }
        }

        return {
            modelUsage: Array.from(modelUsage.entries()).map(([model, count]) => ({ model, count })),
            modelCost: Array.from(modelCost.entries()).map(([model, cost]) => ({ model, cost: Math.round(cost * 1_000_000) / 1_000_000 })),
            modelTokens: Array.from(modelTokens.entries()).map(([model, tokens]) => ({ model, tokens })),
        }
    },

    async exportData(payload: IMetricsExportPayload): Promise<{ json: string; csv: string }> {
        const report = await this.exportReport(payload)

        // JSON export
        const json = JSON.stringify(report, null, 2)

        // CSV export
        const csvLines = ['Date,Total Tokens,Total Cost,Execution Count,Tool Calls']

        for (const daily of report.dailySummaries) {
            csvLines.push(`${daily.date},${daily.totalTokens},${daily.totalCost},${daily.executionCount},${daily.toolCalls}`)
        }

        return { json, csv: csvLines.join('\n') }
    },

    getTracker(): TokenTracker {
        return tracker
    },
}

// Helper to aggregate data by key
function aggregateByKey<T extends { [key: string]: string | number }>(
    data: T[],
    keyField: keyof T,
    valueField: keyof T
): T[] {
    const map = new Map<string, number>()

    for (const item of data) {
        const key = String(item[keyField])
        const value = Number(item[valueField])
        map.set(key, (map.get(key) ?? 0) + value)
    }

    return Array.from(map.entries())
        .map(([key, value]) => ({ [keyField]: key, [valueField]: value } as T))
        .sort((a, b) => Number(b[valueField]) - Number(a[valueField]))
}
