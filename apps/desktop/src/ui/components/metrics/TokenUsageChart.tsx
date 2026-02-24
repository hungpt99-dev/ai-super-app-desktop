import React from 'react'

interface TokenUsageChartProps {
    readonly promptTokens: number
    readonly completionTokens: number
    readonly totalTokens: number
    readonly planningTokens: number
    readonly executionTokens: number
    readonly microTokens: number
}

function Bar({ label, value, max, color }: { readonly label: string; readonly value: number; readonly max: number; readonly color: string }): React.JSX.Element {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
    return (
        <div className="flex items-center gap-3 mb-2">
            <span className="text-gray-400 text-sm w-28 text-right">{label}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                />
            </div>
            <span className="text-white text-sm font-mono w-24 text-right">{value.toLocaleString()}</span>
        </div>
    )
}

export function TokenUsageChart({
    promptTokens,
    completionTokens,
    totalTokens,
    planningTokens,
    executionTokens,
    microTokens,
}: TokenUsageChartProps): React.JSX.Element {
    const maxTokens = Math.max(totalTokens, 1)
    const maxPhase = Math.max(planningTokens, executionTokens, microTokens, 1)

    return (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Token Usage</h3>
            <div className="space-y-1">
                <Bar label="Total" value={totalTokens} max={maxTokens} color="#3b82f6" />
                <Bar label="Prompt" value={promptTokens} max={maxTokens} color="#8b5cf6" />
                <Bar label="Completion" value={completionTokens} max={maxTokens} color="#06b6d4" />
            </div>
            <h4 className="text-sm font-medium text-gray-400 mt-4 mb-2">By Phase</h4>
            <div className="space-y-1">
                <Bar label="Planning" value={planningTokens} max={maxPhase} color="#f59e0b" />
                <Bar label="Execution" value={executionTokens} max={maxPhase} color="#10b981" />
                <Bar label="Micro" value={microTokens} max={maxPhase} color="#ec4899" />
            </div>
        </div>
    )
}
