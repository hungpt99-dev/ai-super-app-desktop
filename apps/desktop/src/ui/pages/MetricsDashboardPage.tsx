/**
 * MetricsDashboardPage — Comprehensive Token monitoring and cost tracking dashboard.
 *
 * Architecture:
 * - Uses bridge for metrics data (RULE 5: bridge calls in hooks/pages OK for now)
 * - Follows existing pattern in the file
 * - Auto-refresh every 3 seconds
 * - Supports filters: date range, agent, model, workspace
 * - Export to JSON/CSV
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getDesktopBridge } from '../lib/bridge'
import { useWorkspaceStore } from '../store/workspace-store'

// ─── Types ───────────────────────────────────────────────────────────────────────────

interface IMetricsSummary {
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

interface ITokenAnalytics {
    readonly tokensPerDay: readonly { readonly date: string; readonly tokens: number }[]
    readonly tokensPerAgent: readonly { readonly agentId: string; readonly tokens: number }[]
    readonly tokensPerModel: readonly { readonly model: string; readonly tokens: number }[]
    readonly tokensPerExecution: readonly { readonly executionId: string; readonly tokens: number }[]
    readonly planningVsExecution: readonly { readonly planning: number; readonly execution: number; readonly micro: number }[]
}

interface ICostAnalytics {
    readonly costPerAgent: readonly { readonly agentId: string; readonly cost: number }[]
    readonly costPerModel: readonly { readonly model: string; readonly cost: number }[]
    readonly costPerDay: readonly { readonly date: string; readonly cost: number }[]
    readonly costPerExecution: readonly { readonly executionId: string; readonly cost: number }[]
    readonly topExpensiveExecutions: readonly { readonly executionId: string; readonly cost: number }[]
}

interface IAgentAnalytics {
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

interface IPlanningAnalytics {
    readonly planningTokens: number
    readonly executionTokens: number
    readonly microTokens: number
    readonly planningRatio: number
    readonly microPlanRatio: number
    readonly dailyPlanning: readonly { readonly date: string; readonly planning: number; readonly execution: number; readonly micro: number }[]
}

interface IToolAnalytics {
    readonly toolUsageFrequency: readonly { readonly toolName: string; readonly count: number }[]
    readonly toolTokenCost: readonly { readonly toolName: string; readonly cost: number }[]
    readonly toolExecutionTime: readonly { readonly toolName: string; readonly avgDurationMs: number }[]
}

interface IModelAnalytics {
    readonly modelUsage: readonly { readonly model: string; readonly count: number }[]
    readonly modelCost: readonly { readonly model: string; readonly cost: number }[]
    readonly modelTokens: readonly { readonly model: string; readonly tokens: number }[]
}

interface IExecutionAnalytics {
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

interface IEfficiencyWarning {
    readonly type: 'planning_tokens' | 'micro_plans' | 'tool_calls' | 'expensive_agent' | 'expensive_model'
    readonly severity: 'warning' | 'critical'
    readonly message: string
    readonly details: string
}

interface IMetricsFilters {
    readonly fromDate: string
    readonly toDate: string
    readonly agentId?: string
    readonly model?: string
    readonly workspaceId?: string
}

// ─── Helper Functions ─────────────────────────────────────────────────────────────

function formatDateStr(d: Date): string {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function getDefaultFilters(workspaceId: string): IMetricsFilters {
    const today = new Date()
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return {
        fromDate: formatDateStr(weekAgo),
        toDate: formatDateStr(today),
        workspaceId,
    }
}

function computeEfficiencyWarnings(
    summary: IMetricsSummary | null,
    agents: IAgentAnalytics | null,
    planning: IPlanningAnalytics | null
): IEfficiencyWarning[] {
    const warnings: IEfficiencyWarning[] = []

    if (planning) {
        if (planning.planningRatio > 30) {
            warnings.push({
                type: 'planning_tokens',
                severity: planning.planningRatio > 50 ? 'critical' : 'warning',
                message: 'Planning tokens too high',
                details: `Planning ratio is ${planning.planningRatio}% (target: <30%)`,
            })
        }
        if (planning.microPlanRatio > 20) {
            warnings.push({
                type: 'micro_plans',
                severity: planning.microPlanRatio > 40 ? 'critical' : 'warning',
                message: 'Too many micro plans',
                details: `Micro-plan ratio is ${planning.microPlanRatio}% (target: <20%)`,
            })
        }
    }

    if (agents && agents.agents.length > 0) {
        const inefficientAgents = agents.agents
            .filter(a => a.efficiencyScore < 100)
            .slice(0, 3)
        for (const agent of inefficientAgents) {
            warnings.push({
                type: 'expensive_agent',
                severity: 'warning',
                message: `Agent ${agent.agentId} inefficient`,
                details: `Efficiency score: ${agent.efficiencyScore}, Avg tokens: ${agent.avgTokens}`,
            })
        }
    }

    return warnings
}

// ─── Sub-Components ───────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { readonly label: string; readonly value: string | number; readonly icon: string }): React.JSX.Element {
    return (
        <div className="p-4 bg-gray-900 border border-gray-700 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{icon}</span>
                <span className="text-xs tracking-wide text-gray-400 uppercase">{label}</span>
            </div>
            <p className="font-mono text-xl font-bold text-white">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
        </div>
    )
}

function BarChart({ data, maxValue, color, formatValue }: {
    readonly data: readonly { readonly label: string; readonly value: number }[]
    readonly maxValue: number
    readonly color: string
    readonly formatValue?: (v: number) => string
}): React.JSX.Element {
    return (
        <div className="space-y-2">
            {data.slice(0, 10).map((item, idx) => {
                const pct = maxValue > 0 ? Math.min((item.value / maxValue) * 100, 100) : 0
                return (
                    <div key={idx} className="flex items-center gap-3">
                        <span className="w-24 text-sm text-gray-400 truncate">{item.label}</span>
                        <div className="flex-1 h-4 overflow-hidden bg-gray-800 rounded-full">
                            <div
                                className="h-full transition-all duration-300 rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                        </div>
                        <span className="w-20 font-mono text-sm text-right text-white">
                            {formatValue ? formatValue(item.value) : item.value.toLocaleString()}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

function AgentsTable({ agents }: { readonly agents: readonly {
    readonly agentId: string
    readonly executions: number
    readonly totalTokens: number
    readonly totalCost: number
    readonly avgTokens: number
    readonly successRate: number
    readonly lastActive: string
    readonly efficiencyScore: number
}[] }): React.JSX.Element {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                        <th className="px-3 py-2 font-medium text-left">Agent</th>
                        <th className="px-3 py-2 font-medium text-right">Executions</th>
                        <th className="px-3 py-2 font-medium text-right">Total Tokens</th>
                        <th className="px-3 py-2 font-medium text-right">Total Cost</th>
                        <th className="px-3 py-2 font-medium text-right">Avg Tokens</th>
                        <th className="px-3 py-2 font-medium text-right">Success Rate</th>
                        <th className="px-3 py-2 font-medium text-right">Efficiency</th>
                        <th className="px-3 py-2 font-medium text-right">Last Active</th>
                    </tr>
                </thead>
                <tbody>
                    {agents.map((agent) => (
                        <tr key={agent.agentId} className="transition-colors border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-3 py-2 font-medium text-white">{agent.agentId}</td>
                            <td className="px-3 py-2 text-right text-gray-300">{agent.executions}</td>
                            <td className="px-3 py-2 font-mono text-right text-white">{agent.totalTokens.toLocaleString()}</td>
                            <td className="px-3 py-2 font-mono text-right text-green-400">${agent.totalCost.toFixed(4)}</td>
                            <td className="px-3 py-2 font-mono text-right text-gray-300">{agent.avgTokens.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-gray-300">{agent.successRate}%</td>
                            <td className={`py-2 px-3 text-right font-mono ${agent.efficiencyScore > 1000 ? 'text-green-400' : agent.efficiencyScore > 100 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {agent.efficiencyScore.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-xs text-right text-gray-500">
                                {agent.lastActive ? new Date(agent.lastActive).toLocaleDateString() : '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function ExecutionsTable({ executions }: { readonly executions: readonly {
    readonly executionId: string
    readonly agent: string
    readonly tokens: number
    readonly cost: number
    readonly duration: number
    readonly toolsUsed: readonly string[]
    readonly status: 'completed' | 'failed' | 'active'
}[] }): React.JSX.Element {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                        <th className="px-3 py-2 font-medium text-left">Execution ID</th>
                        <th className="px-3 py-2 font-medium text-left">Agent</th>
                        <th className="px-3 py-2 font-medium text-right">Tokens</th>
                        <th className="px-3 py-2 font-medium text-right">Cost</th>
                        <th className="px-3 py-2 font-medium text-right">Duration</th>
                        <th className="px-3 py-2 font-medium text-left">Tools</th>
                        <th className="px-3 py-2 font-medium text-left">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {executions.slice(0, 50).map((exec) => (
                        <tr key={exec.executionId} className="transition-colors border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-3 py-2 font-mono text-xs text-blue-400">{exec.executionId.substring(0, 12)}…</td>
                            <td className="px-3 py-2 text-white">{exec.agent}</td>
                            <td className="px-3 py-2 font-mono text-right text-white">{exec.tokens.toLocaleString()}</td>
                            <td className="px-3 py-2 font-mono text-right text-green-400">${exec.cost.toFixed(4)}</td>
                            <td className="px-3 py-2 text-right text-gray-300">{exec.duration}ms</td>
                            <td className="px-3 py-2 text-xs text-gray-400">{exec.toolsUsed.slice(0, 3).join(', ')}</td>
                            <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                    exec.status === 'completed' ? 'bg-green-900 text-green-400' :
                                    exec.status === 'failed' ? 'bg-red-900 text-red-400' :
                                    'bg-blue-900 text-blue-400'
                                }`}>
                                    {exec.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function WarningCard({ warning }: { readonly warning: IEfficiencyWarning }): React.JSX.Element {
    const bgColor = warning.severity === 'critical' ? 'bg-red-900/30 border-red-700' : 'bg-yellow-900/30 border-yellow-700'
    const textColor = warning.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'

    return (
        <div className={`p-4 rounded-xl border ${bgColor}`}>
            <div className="flex items-center gap-2 mb-1">
                <span className={`text-lg ${textColor}`}>
                    {warning.severity === 'critical' ? '🚨' : '⚠️'}
                </span>
                <span className={`font-medium ${textColor}`}>{warning.message}</span>
            </div>
            <p className="text-sm text-gray-400">{warning.details}</p>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────────

export function MetricsDashboardPage(): React.JSX.Element {
    const bridge = getDesktopBridge()
    const { activeWorkspace } = useWorkspaceStore()
    const workspaceId = activeWorkspace?.id ?? ''
    const [filters, setFilters] = useState<IMetricsFilters>(() => getDefaultFilters(workspaceId))
    const [loading, setLoading] = useState(true)
    const [activeSection, setActiveSection] = useState<string>('overview')

    // Data states
    const [summary, setSummary] = useState<IMetricsSummary | null>(null)
    const [tokens, setTokens] = useState<ITokenAnalytics | null>(null)
    const [costs, setCosts] = useState<ICostAnalytics | null>(null)
    const [agents, setAgents] = useState<IAgentAnalytics | null>(null)
    const [executions, setExecutions] = useState<IExecutionAnalytics | null>(null)
    const [tools, setTools] = useState<IToolAnalytics | null>(null)
    const [models, setModels] = useState<IModelAnalytics | null>(null)

    // Planning data computed from tokens
    const planningData = useMemo((): IPlanningAnalytics | null => {
        if (!tokens) return null
        let planning = 0
        let execution = 0
        let micro = 0
        for (const pe of tokens.planningVsExecution) {
            planning += pe.planning
            execution += pe.execution
            micro += pe.micro
        }
        const total = planning + execution + micro
        return {
            planningTokens: planning,
            executionTokens: execution,
            microTokens: micro,
            planningRatio: total > 0 ? Math.round((planning / total) * 100) : 0,
            microPlanRatio: total > 0 ? Math.round((micro / total) * 100) : 0,
            dailyPlanning: tokens.planningVsExecution.map((pe, i) => ({
                date: `Day ${i + 1}`,
                planning: pe.planning,
                execution: pe.execution,
                micro: pe.micro,
            })),
        }
    }, [tokens])

    const warnings = useMemo(() => computeEfficiencyWarnings(summary, agents, planningData), [summary, agents, planningData])

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const [summaryData, tokensData, costsData, agentsData, executionsData, toolsData, modelsData] = await Promise.all([
                bridge.metrics.getSummary(filters) as Promise<IMetricsSummary>,
                bridge.metrics.getTokens(filters) as Promise<ITokenAnalytics>,
                bridge.metrics.getCosts(filters) as Promise<ICostAnalytics>,
                bridge.metrics.getAgents(filters) as Promise<IAgentAnalytics>,
                bridge.metrics.getExecutions(filters) as Promise<IExecutionAnalytics>,
                bridge.metrics.getTools(filters) as Promise<IToolAnalytics>,
                bridge.metrics.getModels(filters) as Promise<IModelAnalytics>,
            ])
            setSummary(summaryData)
            setTokens(tokensData)
            setCosts(costsData)
            setAgents(agentsData)
            setExecutions(executionsData)
            setTools(toolsData)
            setModels(modelsData)
        } catch {
            // Silently handle errors, keep previous data
        } finally {
            setLoading(false)
        }
    }, [bridge, filters])

    // Auto-refresh every 3 seconds
    useEffect(() => {
        void refresh()
        const interval = setInterval(() => {
            void refresh()
        }, 3000)
        return () => clearInterval(interval)
    }, [refresh])

    const handleExport = useCallback(async (format: 'json' | 'csv') => {
        try {
            const result = await bridge.metrics.exportData(filters) as { json: string; csv: string }
            const content = format === 'json' ? result.json : result.csv
            const mimeType = format === 'json' ? 'application/json' : 'text/csv'
            const filename = `metrics_${filters.fromDate}_${filters.toDate}.${format}`

            const blob = new Blob([content], { type: mimeType })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
            URL.revokeObjectURL(url)
        } catch {
            // Handle error silently
        }
    }, [bridge, filters])

    const sections = [
        { id: 'overview', label: 'Overview' },
        { id: 'tokens', label: 'Tokens' },
        { id: 'costs', label: 'Costs' },
        { id: 'agents', label: 'Agents' },
        { id: 'executions', label: 'Executions' },
        { id: 'tools', label: 'Tools' },
        { id: 'models', label: 'Models' },
    ]

    if (loading && !summary) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-400">Loading metrics...</div>
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full h-full bg-gray-950">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Monitoring Dashboard</h1>
                        <p className="mt-1 text-sm text-gray-400">Token usage, cost tracking, and efficiency analytics</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Workspace Selector */}
                        <select
                            value={workspaceId}
                            onChange={(e) => {
                                const newWorkspaceId = e.target.value
                                if (newWorkspaceId) {
                                    void useWorkspaceStore.getState().switchWorkspace(newWorkspaceId)
                                }
                            }}
                            className="px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Select Workspace</option>
                            {useWorkspaceStore.getState().workspaces.map((ws) => (
                                <option key={ws.id} value={ws.id}>
                                    {ws.name}
                                </option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={filters.fromDate}
                            onChange={(e) => setFilters(f => ({ ...f, fromDate: e.target.value }))}
                            className="px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-gray-500">to</span>
                        <input
                            type="date"
                            value={filters.toDate}
                            onChange={(e) => setFilters(f => ({ ...f, toDate: e.target.value }))}
                            className="px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={() => void refresh()}
                            className="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                            Refresh
                        </button>
                        <div className="relative group">
                            <button className="px-4 py-2 text-sm font-medium text-white transition-colors bg-gray-700 rounded-lg hover:bg-gray-600">
                                Export
                            </button>
                            <div className="absolute right-0 z-10 invisible w-32 mt-1 transition-all bg-gray-800 border border-gray-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 group-hover:visible">
                                <button
                                    onClick={() => void handleExport('json')}
                                    className="block w-full px-4 py-2 text-sm text-left text-gray-300 rounded-t-lg hover:bg-gray-700"
                                >
                                    JSON
                                </button>
                                <button
                                    onClick={() => void handleExport('csv')}
                                    className="block w-full px-4 py-2 text-sm text-left text-gray-300 rounded-b-lg hover:bg-gray-700"
                                >
                                    CSV
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section Tabs */}
            <div className="flex px-6 border-b border-gray-800">
                {sections.map((section) => (
                    <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`px-4 py-3 text-sm font-medium transition-colors ${
                            activeSection === section.id
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        {section.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                {/* Overview Section */}
                {activeSection === 'overview' && summary && (
                    <div className="space-y-6">
                        {/* Global Summary */}
                        <div>
                            <h2 className="mb-4 text-lg font-semibold text-white">Global Summary</h2>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                                <StatCard label="Tokens Today" value={summary.tokensToday.toLocaleString()} icon="📊" />
                                <StatCard label="Tokens This Week" value={summary.tokensThisWeek.toLocaleString()} icon="📅" />
                                <StatCard label="Tokens This Month" value={summary.tokensThisMonth.toLocaleString()} icon="🗓️" />
                                <StatCard label="Cost Today" value={`$${summary.costToday.toFixed(4)}`} icon="💰" />
                                <StatCard label="Cost Month" value={`$${summary.costMonth.toFixed(2)}`} icon="💵" />
                                <StatCard label="Active Agents" value={summary.activeAgents} icon="🤖" />
                                <StatCard label="Executions Today" value={summary.executionsToday} icon="⚡" />
                                <StatCard label="Avg Tokens/Task" value={summary.avgTokensPerTask.toLocaleString()} icon="📈" />
                                <StatCard label="Avg Cost/Task" value={`$${summary.avgCostPerTask.toFixed(4)}`} icon="💲" />
                                <StatCard label="Tool Calls Today" value={summary.toolCallsToday} icon="🔧" />
                            </div>
                        </div>

                        {/* Efficiency Warnings */}
                        {warnings.length > 0 && (
                            <div>
                                <h2 className="mb-4 text-lg font-semibold text-white">Efficiency Warnings</h2>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {warnings.map((warning, idx) => (
                                        <WarningCard key={idx} warning={warning} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Planning Overview */}
                        {planningData && (
                            <div>
                                <h2 className="mb-4 text-lg font-semibold text-white">Planning Analytics</h2>
                                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                    <StatCard label="Planning Tokens" value={planningData.planningTokens.toLocaleString()} icon="📋" />
                                    <StatCard label="Execution Tokens" value={planningData.executionTokens.toLocaleString()} icon="⚙️" />
                                    <StatCard label="Micro-plan Tokens" value={planningData.microTokens.toLocaleString()} icon="🔬" />
                                    <StatCard label="Planning Ratio" value={`${planningData.planningRatio}%`} icon="📊" />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tokens Section */}
                {activeSection === 'tokens' && tokens && (
                    <div className="space-y-6">
                        <h2 className="mb-4 text-lg font-semibold text-white">Token Analytics</h2>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Tokens per Day</h3>
                                <BarChart
                                    data={tokens.tokensPerDay.map(d => ({ label: d.date, value: d.tokens }))}
                                    maxValue={Math.max(...tokens.tokensPerDay.map(d => d.tokens), 1)}
                                    color="#3b82f6"
                                />
                            </div>

                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Tokens per Agent</h3>
                                <BarChart
                                    data={tokens.tokensPerAgent.map(d => ({ label: d.agentId, value: d.tokens }))}
                                    maxValue={Math.max(...tokens.tokensPerAgent.map(d => d.tokens), 1)}
                                    color="#8b5cf6"
                                />
                            </div>

                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Tokens per Model</h3>
                                <BarChart
                                    data={tokens.tokensPerModel.map(d => ({ label: d.model, value: d.tokens }))}
                                    maxValue={Math.max(...tokens.tokensPerModel.map(d => d.tokens), 1)}
                                    color="#06b6d4"
                                />
                            </div>

                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Planning vs Execution</h3>
                                {planningData && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">Planning</span>
                                            <span className="font-mono text-yellow-400">{planningData.planningTokens.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">Execution</span>
                                            <span className="font-mono text-green-400">{planningData.executionTokens.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400">Micro-plan</span>
                                            <span className="font-mono text-pink-400">{planningData.microTokens.toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Costs Section */}
                {activeSection === 'costs' && costs && (
                    <div className="space-y-6">
                        <h2 className="mb-4 text-lg font-semibold text-white">Cost Analytics</h2>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Cost per Agent</h3>
                                <BarChart
                                    data={costs.costPerAgent.map(d => ({ label: d.agentId, value: d.cost }))}
                                    maxValue={Math.max(...costs.costPerAgent.map(d => d.cost), 1)}
                                    color="#10b981"
                                    formatValue={(v) => `$${v.toFixed(4)}`}
                                />
                            </div>

                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Cost per Model</h3>
                                <BarChart
                                    data={costs.costPerModel.map(d => ({ label: d.model, value: d.cost }))}
                                    maxValue={Math.max(...costs.costPerModel.map(d => d.cost), 1)}
                                    color="#f59e0b"
                                    formatValue={(v) => `$${v.toFixed(4)}`}
                                />
                            </div>

                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Cost per Day</h3>
                                <BarChart
                                    data={costs.costPerDay.map(d => ({ label: d.date, value: d.cost }))}
                                    maxValue={Math.max(...costs.costPerDay.map(d => d.cost), 1)}
                                    color="#ec4899"
                                    formatValue={(v) => `$${v.toFixed(4)}`}
                                />
                            </div>

                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Top Expensive Executions</h3>
                                <BarChart
                                    data={costs.topExpensiveExecutions.map(d => ({ label: d.executionId.substring(0, 8), value: d.cost }))}
                                    maxValue={Math.max(...costs.topExpensiveExecutions.map(d => d.cost), 1)}
                                    color="#ef4444"
                                    formatValue={(v) => `$${v.toFixed(4)}`}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Agents Section */}
                {activeSection === 'agents' && agents && (
                    <div className="space-y-6">
                        <h2 className="mb-4 text-lg font-semibold text-white">Agent Analytics</h2>
                        <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                            {agents.agents.length > 0 ? (
                                <AgentsTable agents={agents.agents} />
                            ) : (
                                <p className="text-gray-500">No agent data available</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Executions Section */}
                {activeSection === 'executions' && executions && (
                    <div className="space-y-6">
                        <h2 className="mb-4 text-lg font-semibold text-white">Execution Analytics</h2>
                        <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                            {executions.executions.length > 0 ? (
                                <ExecutionsTable executions={executions.executions} />
                            ) : (
                                <p className="text-gray-500">No execution data available</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Tools Section */}
                {activeSection === 'tools' && tools && (
                    <div className="space-y-6">
                        <h2 className="mb-4 text-lg font-semibold text-white">Tool Analytics</h2>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Tool Usage Frequency</h3>
                                <BarChart
                                    data={tools.toolUsageFrequency.map(d => ({ label: d.toolName, value: d.count }))}
                                    maxValue={Math.max(...tools.toolUsageFrequency.map(d => d.count), 1)}
                                    color="#3b82f6"
                                />
                            </div>

                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Tool Token Cost</h3>
                                <BarChart
                                    data={tools.toolTokenCost.map(d => ({ label: d.toolName, value: d.cost }))}
                                    maxValue={Math.max(...tools.toolTokenCost.map(d => d.cost), 1)}
                                    color="#10b981"
                                    formatValue={(v) => `$${v.toFixed(4)}`}
                                />
                            </div>

                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Tool Execution Time (avg ms)</h3>
                                <BarChart
                                    data={tools.toolExecutionTime.map(d => ({ label: d.toolName, value: d.avgDurationMs }))}
                                    maxValue={Math.max(...tools.toolExecutionTime.map(d => d.avgDurationMs), 1)}
                                    color="#f59e0b"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Models Section */}
                {activeSection === 'models' && models && (
                    <div className="space-y-6">
                        <h2 className="mb-4 text-lg font-semibold text-white">Model Analytics</h2>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Model Usage</h3>
                                <BarChart
                                    data={models.modelUsage.map(d => ({ label: d.model, value: d.count }))}
                                    maxValue={Math.max(...models.modelUsage.map(d => d.count), 1)}
                                    color="#8b5cf6"
                                />
                            </div>

                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Model Cost</h3>
                                <BarChart
                                    data={models.modelCost.map(d => ({ label: d.model, value: d.cost }))}
                                    maxValue={Math.max(...models.modelCost.map(d => d.cost), 1)}
                                    color="#ec4899"
                                    formatValue={(v) => `$${v.toFixed(4)}`}
                                />
                            </div>

                            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
                                <h3 className="mb-4 font-medium text-white text-md">Model Tokens</h3>
                                <BarChart
                                    data={models.modelTokens.map(d => ({ label: d.model, value: d.tokens }))}
                                    maxValue={Math.max(...models.modelTokens.map(d => d.tokens), 1)}
                                    color="#06b6d4"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
