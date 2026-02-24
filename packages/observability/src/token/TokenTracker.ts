/**
 * TokenTracker — stateless aggregation service for token and tool usage.
 *
 * Responsibilities:
 * - Record token usage (via MetricsStore)
 * - Record tool calls (via MetricsStore)
 * - Aggregate per execution, agent, workspace, day, model
 * - Deterministic aggregation
 * - Stateless in memory — all persistence via MetricsStore
 *
 * Emits events to ObservabilityAdapter.
 */

import type {
    TokenUsageRecord,
    ToolUsageRecord,
    ExecutionCostSummary,
    DailyUsageSummary,
    AgentBreakdown,
    AgentCostSummary,
    AgentDetailedBreakdown,
    ModelUsageSummary,
    PhaseTokens,
    IMetricsStore,
} from './MetricsTypes.js'
import { CostCalculator } from './CostCalculator.js'

export type MetricsEventCallback = (event: {
    readonly type: 'token_recorded' | 'tool_recorded'
    readonly record: TokenUsageRecord | ToolUsageRecord
}) => void

export class TokenTracker {
    private readonly store: IMetricsStore
    private readonly calculator: CostCalculator
    private readonly listeners = new Set<MetricsEventCallback>()

    constructor(store: IMetricsStore, calculator?: CostCalculator) {
        this.store = store
        this.calculator = calculator ?? new CostCalculator()
    }

    onEvent(callback: MetricsEventCallback): () => void {
        this.listeners.add(callback)
        return () => { this.listeners.delete(callback) }
    }

    private emit(event: Parameters<MetricsEventCallback>[0]): void {
        for (const listener of this.listeners) {
            listener(event)
        }
    }

    async recordLLMUsage(record: TokenUsageRecord): Promise<void> {
        await this.store.appendTokenUsage(record)
        this.emit({ type: 'token_recorded', record })
    }

    async recordToolCall(record: ToolUsageRecord): Promise<void> {
        await this.store.appendToolUsage(record)
        this.emit({ type: 'tool_recorded', record })
    }

    async getExecutionSummary(executionId: string): Promise<ExecutionCostSummary> {
        const { tokens, tools } = await this.store.getExecutionRecords(executionId)

        const agentMap = new Map<string, { prompt: number; completion: number; model: string }>()
        let totalPrompt = 0
        let totalCompletion = 0
        let model = 'unknown'
        const phases = { planning: { tokens: 0, cost: 0 }, execution: { tokens: 0, cost: 0 }, micro: { tokens: 0, cost: 0 } }

        for (const t of tokens) {
            totalPrompt += t.promptTokens
            totalCompletion += t.completionTokens
            model = t.model

            const existing = agentMap.get(t.agentId)
            if (existing) {
                existing.prompt += t.promptTokens
                existing.completion += t.completionTokens
            } else {
                agentMap.set(t.agentId, { prompt: t.promptTokens, completion: t.completionTokens, model: t.model })
            }

            const phaseTokens = t.promptTokens + t.completionTokens
            const phaseCost = this.calculator.calculateCost(t.model, t.promptTokens, t.completionTokens)
            phases[t.phase].tokens += phaseTokens
            phases[t.phase].cost += phaseCost
        }

        const agents: AgentCostSummary[] = []
        for (const [agentId, data] of agentMap) {
            agents.push({
                agentId,
                tokens: data.prompt + data.completion,
                cost: this.calculator.calculateCost(data.model, data.prompt, data.completion),
                promptTokens: data.prompt,
                completionTokens: data.completion,
            })
        }
        agents.sort((a, b) => a.agentId.localeCompare(b.agentId))

        const totalTokens = totalPrompt + totalCompletion
        const totalCost = this.calculator.calculateCost(model, totalPrompt, totalCompletion)

        return {
            executionId,
            workspaceId: tokens[0]?.workspaceId ?? '',
            totalTokens,
            totalCost,
            promptTokens: totalPrompt,
            completionTokens: totalCompletion,
            agents,
            toolCalls: tools.length,
            phases: {
                planning: { tokens: phases.planning.tokens, cost: Math.round(phases.planning.cost * 1_000_000) / 1_000_000 },
                execution: { tokens: phases.execution.tokens, cost: Math.round(phases.execution.cost * 1_000_000) / 1_000_000 },
                micro: { tokens: phases.micro.tokens, cost: Math.round(phases.micro.cost * 1_000_000) / 1_000_000 },
            },
            model,
            timestamp: tokens[0]?.timestamp ?? Date.now(),
        }
    }

    async getDailyUsage(date: string): Promise<DailyUsageSummary> {
        const tokenRecords = await this.store.getDailyTokenRecords(date)
        const toolRecords = await this.store.getDailyToolRecords(date)

        let totalPrompt = 0
        let totalCompletion = 0
        const agentMap = new Map<string, { prompt: number; completion: number; model: string }>()
        const modelMap = new Map<string, { prompt: number; completion: number }>()
        const executionIds = new Set<string>()

        for (const t of tokenRecords) {
            totalPrompt += t.promptTokens
            totalCompletion += t.completionTokens
            executionIds.add(t.executionId)

            const agent = agentMap.get(t.agentId)
            if (agent) {
                agent.prompt += t.promptTokens
                agent.completion += t.completionTokens
            } else {
                agentMap.set(t.agentId, { prompt: t.promptTokens, completion: t.completionTokens, model: t.model })
            }

            const m = modelMap.get(t.model)
            if (m) {
                m.prompt += t.promptTokens
                m.completion += t.completionTokens
            } else {
                modelMap.set(t.model, { prompt: t.promptTokens, completion: t.completionTokens })
            }
        }

        const agents: AgentCostSummary[] = []
        for (const [agentId, data] of agentMap) {
            agents.push({
                agentId,
                tokens: data.prompt + data.completion,
                cost: this.calculator.calculateCost(data.model, data.prompt, data.completion),
                promptTokens: data.prompt,
                completionTokens: data.completion,
            })
        }
        agents.sort((a, b) => b.tokens - a.tokens)

        const models: ModelUsageSummary[] = []
        for (const [modelName, data] of modelMap) {
            models.push({
                model: modelName,
                promptTokens: data.prompt,
                completionTokens: data.completion,
                totalTokens: data.prompt + data.completion,
                cost: this.calculator.calculateCost(modelName, data.prompt, data.completion),
            })
        }
        models.sort((a, b) => b.totalTokens - a.totalTokens)

        const totalTokens = totalPrompt + totalCompletion
        let totalCost = 0
        for (const a of agents) totalCost += a.cost
        totalCost = Math.round(totalCost * 1_000_000) / 1_000_000

        return {
            date,
            totalTokens,
            totalCost,
            promptTokens: totalPrompt,
            completionTokens: totalCompletion,
            executionCount: executionIds.size,
            agents,
            models,
            toolCalls: toolRecords.length,
        }
    }

    async getAgentBreakdown(date: string): Promise<AgentBreakdown> {
        const tokenRecords = await this.store.getDailyTokenRecords(date)

        const agentMap = new Map<string, {
            total: number; cost: number; executions: Set<string>
            planning: number; execution: number; micro: number
            model: string
        }>()

        for (const t of tokenRecords) {
            const total = t.promptTokens + t.completionTokens
            const cost = this.calculator.calculateCost(t.model, t.promptTokens, t.completionTokens)
            const existing = agentMap.get(t.agentId)

            if (existing) {
                existing.total += total
                existing.cost += cost
                existing.executions.add(t.executionId)
                if (t.phase === 'planning') existing.planning += total
                else if (t.phase === 'execution') existing.execution += total
                else existing.micro += total
            } else {
                agentMap.set(t.agentId, {
                    total,
                    cost,
                    executions: new Set([t.executionId]),
                    planning: t.phase === 'planning' ? total : 0,
                    execution: t.phase === 'execution' ? total : 0,
                    micro: t.phase === 'micro' ? total : 0,
                    model: t.model,
                })
            }
        }

        const agents: AgentDetailedBreakdown[] = []
        for (const [agentId, data] of agentMap) {
            agents.push({
                agentId,
                totalTokens: data.total,
                totalCost: Math.round(data.cost * 1_000_000) / 1_000_000,
                executionCount: data.executions.size,
                averageTokensPerExecution: data.executions.size > 0
                    ? Math.round(data.total / data.executions.size)
                    : 0,
                planningTokens: data.planning,
                executionTokens: data.execution,
                microTokens: data.micro,
            })
        }
        agents.sort((a, b) => b.totalTokens - a.totalTokens)

        return { date, agents }
    }

    getCostCalculator(): CostCalculator {
        return this.calculator
    }

    removeAllListeners(): void {
        this.listeners.clear()
    }
}
