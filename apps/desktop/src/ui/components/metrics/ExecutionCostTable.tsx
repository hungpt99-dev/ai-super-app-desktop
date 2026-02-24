import React from 'react'

interface ExecutionRow {
    readonly executionId: string
    readonly totalTokens: number
    readonly totalCost: number
    readonly model: string
    readonly toolCalls: number
    readonly timestamp: number
}

interface ExecutionCostTableProps {
    readonly executions: readonly ExecutionRow[]
}

export function ExecutionCostTable({ executions }: ExecutionCostTableProps): React.JSX.Element {
    return (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Execution History</h3>
            {executions.length === 0 ? (
                <p className="text-gray-500 text-sm">No execution data available.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-400 border-b border-gray-700">
                                <th className="text-left py-2 px-3 font-medium">Execution ID</th>
                                <th className="text-right py-2 px-3 font-medium">Tokens</th>
                                <th className="text-right py-2 px-3 font-medium">Cost</th>
                                <th className="text-left py-2 px-3 font-medium">Model</th>
                                <th className="text-right py-2 px-3 font-medium">Tool Calls</th>
                                <th className="text-right py-2 px-3 font-medium">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {executions.map((exec) => (
                                <tr key={exec.executionId} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                                    <td className="py-2 px-3 text-blue-400 font-mono text-xs">{exec.executionId.substring(0, 12)}…</td>
                                    <td className="py-2 px-3 text-right text-white font-mono">{exec.totalTokens.toLocaleString()}</td>
                                    <td className="py-2 px-3 text-right text-green-400 font-mono">${exec.totalCost.toFixed(4)}</td>
                                    <td className="py-2 px-3 text-gray-300">{exec.model}</td>
                                    <td className="py-2 px-3 text-right text-gray-300">{exec.toolCalls}</td>
                                    <td className="py-2 px-3 text-right text-gray-500 text-xs">{new Date(exec.timestamp).toLocaleTimeString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
