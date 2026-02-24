/**
 * TestRunnerPage — Execute test scenarios and view results.
 * - List available test scenarios
 * - Run individual or all scenarios
 * - View results with pass/fail, diff, latency, token usage
 *
 * All data fetched via IPC bridge.
 */

import React, { useState, useEffect, useCallback } from 'react'
import type { ITestRunResult, ITestResultDTO } from '@agenthub/contracts'
import { getDesktopExtendedBridge } from '../../bridges/desktop-bridge'

interface IProps {
    workspaceId: string
}

interface IScenarioEntry {
    readonly id: string
    readonly name: string
    readonly agentId: string
}

export function TestRunnerPage({ workspaceId }: IProps): React.JSX.Element {
    const bridge = getDesktopExtendedBridge()
    const [scenarios, setScenarios] = useState<readonly IScenarioEntry[]>([])
    const [results, setResults] = useState<ITestRunResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState<string | null>(null)
    const [runningAll, setRunningAll] = useState(false)
    const [selectedResult, setSelectedResult] = useState<ITestResultDTO | null>(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const [scenarioList, resultData] = await Promise.all([
                bridge.testing.listScenarios(workspaceId),
                bridge.testing.getResults(workspaceId),
            ])
            setScenarios(scenarioList)
            setResults(resultData)
        } finally {
            setLoading(false)
        }
    }, [workspaceId])

    useEffect(() => { void refresh() }, [workspaceId])

    const handleRunScenario = async (scenarioId: string) => {
        setRunning(scenarioId)
        try {
            const result = await bridge.testing.runScenario({ scenarioId, workspaceId })
            setResults(result)
        } finally {
            setRunning(null)
        }
    }

    const handleRunAll = async () => {
        setRunningAll(true)
        try {
            const result = await bridge.testing.runAll({ workspaceId })
            setResults(result)
        } finally {
            setRunningAll(false)
        }
    }

    if (loading) {
        return <div className="p-6"><p className="text-gray-400">Loading test scenarios…</p></div>
    }

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 pt-6 pb-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Test Runner</h1>
                        <p className="text-gray-400 text-sm mt-1">Execute agent test scenarios and review results</p>
                    </div>
                    <button
                        onClick={() => void handleRunAll()}
                        disabled={runningAll || scenarios.length === 0}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded font-medium text-sm"
                    >
                        {runningAll ? 'Running All…' : 'Run All'}
                    </button>
                </div>

                {results && (
                    <div className="flex gap-4 mt-3">
                        <span className="text-green-400 text-sm font-medium">
                            {results.totalPassed} passed
                        </span>
                        <span className="text-red-400 text-sm font-medium">
                            {results.totalFailed} failed
                        </span>
                        <span className="text-gray-400 text-sm">
                            {results.totalDuration.toFixed(0)}ms total
                        </span>
                    </div>
                )}
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Scenario list */}
                <div className="w-80 border-r border-gray-700 overflow-y-auto">
                    {scenarios.length === 0 ? (
                        <p className="p-4 text-gray-400 text-sm">No test scenarios found.</p>
                    ) : (
                        scenarios.map((s) => {
                            const result = results?.results.find((r) => r.scenarioId === s.id)
                            return (
                                <div
                                    key={s.id}
                                    className={`p-4 border-b border-gray-700 cursor-pointer hover:bg-gray-800 ${
                                        selectedResult?.scenarioId === s.id ? 'bg-gray-800' : ''
                                    }`}
                                    onClick={() => result && setSelectedResult(result)}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-white text-sm font-medium">{s.name}</span>
                                        {result && (
                                            <span
                                                className={`w-2 h-2 rounded-full ${
                                                    result.passed ? 'bg-green-400' : 'bg-red-400'
                                                }`}
                                            />
                                        )}
                                    </div>
                                    <p className="text-gray-500 text-xs mt-1">Agent: {s.agentId}</p>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            void handleRunScenario(s.id)
                                        }}
                                        disabled={running === s.id}
                                        className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-xs"
                                    >
                                        {running === s.id ? 'Running…' : 'Run'}
                                    </button>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Result detail */}
                <div className="flex-1 overflow-y-auto p-6">
                    {selectedResult ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span
                                    className={`px-3 py-1 rounded font-medium text-sm ${
                                        selectedResult.passed
                                            ? 'bg-green-900/50 text-green-400'
                                            : 'bg-red-900/50 text-red-400'
                                    }`}
                                >
                                    {selectedResult.passed ? 'PASSED' : 'FAILED'}
                                </span>
                                <h2 className="text-xl font-bold text-white">{selectedResult.scenarioName}</h2>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-3 bg-gray-800 rounded border border-gray-700">
                                    <p className="text-gray-400 text-xs">Latency</p>
                                    <p className="text-white font-medium">{selectedResult.latency.toFixed(0)}ms</p>
                                </div>
                                <div className="p-3 bg-gray-800 rounded border border-gray-700">
                                    <p className="text-gray-400 text-xs">Token Usage</p>
                                    <p className="text-white font-medium">{selectedResult.tokenUsage.toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-gray-800 rounded border border-gray-700">
                                    <p className="text-gray-400 text-xs">Executed</p>
                                    <p className="text-white font-medium text-sm">{new Date(selectedResult.executedAt).toLocaleString()}</p>
                                </div>
                            </div>

                            {selectedResult.error && (
                                <div className="p-4 bg-red-900/20 border border-red-700 rounded">
                                    <p className="text-red-400 font-medium text-sm">Error</p>
                                    <pre className="text-red-300 text-xs mt-1 whitespace-pre-wrap">{selectedResult.error}</pre>
                                </div>
                            )}

                            {selectedResult.diff && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-300 mb-2">Diff</h3>
                                    <pre className="p-4 bg-gray-900 rounded border border-gray-700 text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto">
                                        {selectedResult.diff}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-center mt-12">Select a test result to view details</p>
                    )}
                </div>
            </div>
        </div>
    )
}
