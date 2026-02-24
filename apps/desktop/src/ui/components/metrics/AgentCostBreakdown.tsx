import React from 'react'

interface AgentCost {
    readonly agentId: string
    readonly tokens: number
    readonly cost: number
    readonly promptTokens: number
    readonly completionTokens: number
}

interface AgentCostBreakdownProps {
    readonly agents: readonly AgentCost[]
    readonly totalCost: number
}

export function AgentCostBreakdown({ agents, totalCost }: AgentCostBreakdownProps): React.JSX.Element {
    return (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Cost by Agent</h3>
            {agents.length === 0 ? (
                <p className="text-gray-500 text-sm">No agent data available.</p>
            ) : (
                <div className="space-y-3">
                    {agents.map((agent) => {
                        const pct = totalCost > 0 ? ((agent.cost / totalCost) * 100).toFixed(1) : '0.0'
                        return (
                            <div key={agent.agentId} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-medium text-sm">{agent.agentId}</span>
                                        <span className="text-gray-500 text-xs">({pct}%)</span>
                                    </div>
                                    <div className="flex gap-4 mt-1">
                                        <span className="text-gray-400 text-xs">Prompt: {agent.promptTokens.toLocaleString()}</span>
                                        <span className="text-gray-400 text-xs">Completion: {agent.completionTokens.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-green-400 font-mono text-sm">${agent.cost.toFixed(4)}</p>
                                    <p className="text-gray-500 text-xs">{agent.tokens.toLocaleString()} tokens</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
