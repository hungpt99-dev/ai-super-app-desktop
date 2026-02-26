/**
 * PolicyDashboardPage — Governance policy overview and management.
 * - View current policy violations
 * - Check budget status per agent
 * - View rate limit state
 * - Manage allowed/denied models
 *
 * All data fetched via IPC bridge.
 */

import React, { useState, useEffect, useCallback } from 'react'
import type {
    IPolicyEvaluateResult,
    IBudgetResult,
    IModelListResult,
} from '@agenthub/contracts'
import { getDesktopExtendedBridge } from '../../bridges/desktop-bridge'

interface IProps {
    workspaceId: string
}

export function PolicyDashboardPage({ workspaceId }: IProps): React.JSX.Element {
    const bridge = getDesktopExtendedBridge()
    const [budgets, setBudgets] = useState<Map<string, IBudgetResult>>(new Map())
    const [modelList, setModelList] = useState<IModelListResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedTab, setSelectedTab] = useState<'budget' | 'models' | 'evaluate'>('budget')
    const [evaluateAgentId, setEvaluateAgentId] = useState('')
    const [evaluationResult, setEvaluationResult] = useState<IPolicyEvaluateResult | null>(null)
    const [evaluating, setEvaluating] = useState(false)

    const refreshModels = useCallback(async () => {
        try {
            const models = await bridge.governance.getModelList(workspaceId)
            setModelList(models)
        } catch {
            // handle error
        }
    }, [workspaceId])

    useEffect(() => {
        setLoading(true)
        void refreshModels().finally(() => setLoading(false))
    }, [workspaceId])

    const handleEvaluate = async () => {
        if (!evaluateAgentId.trim()) return
        setEvaluating(true)
        try {
            const result = await bridge.governance.evaluatePolicy({
                agentId: evaluateAgentId,
                workspaceId,
                input: {},
            })
            setEvaluationResult(result)
        } finally {
            setEvaluating(false)
        }
    }

    const handleAllowModel = async (modelId: string) => {
        await bridge.governance.allowModel({ modelId, workspaceId })
        await refreshModels()
    }

    const handleDenyModel = async (modelId: string) => {
        await bridge.governance.denyModel({ modelId, workspaceId })
        await refreshModels()
    }

    if (loading) {
        return <div className="p-6"><p className="text-gray-400">Loading governance data…</p></div>
    }

    return (
        <div className="flex flex-col w-full h-full">
            <div className="px-6 pt-6 pb-4 border-b border-gray-700">
                <h1 className="text-2xl font-bold text-white">Policy Dashboard</h1>
                <p className="mt-1 text-sm text-gray-400">Governance, budgets, and model access control</p>
            </div>

            <div className="flex border-b border-gray-700">
                {(['budget', 'models', 'evaluate'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setSelectedTab(tab)}
                        className={`px-4 py-2 text-sm font-medium ${
                            selectedTab === tab
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        {tab === 'budget' ? 'Budgets' : tab === 'models' ? 'Model Registry' : 'Evaluate Policy'}
                    </button>
                ))}
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
                {selectedTab === 'models' && modelList && (
                    <div className="space-y-3">
                        <h2 className="text-lg font-semibold text-white">Registered Models</h2>
                        {modelList.models.length === 0 ? (
                            <p className="text-gray-400">No models registered.</p>
                        ) : (
                            <div className="grid gap-3">
                                {modelList.models.map((model) => (
                                    <div
                                        key={model.modelId}
                                        className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg"
                                    >
                                        <div>
                                            <p className="font-medium text-white">{model.modelId}</p>
                                            <p className="text-sm text-gray-400">Provider: {model.provider} · Max tokens: {model.maxTokens}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-medium ${
                                                    model.status === 'allowed'
                                                        ? 'bg-green-900/50 text-green-400'
                                                        : model.status === 'denied'
                                                        ? 'bg-red-900/50 text-red-400'
                                                        : 'bg-yellow-900/50 text-yellow-400'
                                                }`}
                                            >
                                                {model.status}
                                            </span>
                                            {model.status !== 'allowed' && (
                                                <button
                                                    onClick={() => void handleAllowModel(model.modelId)}
                                                    className="px-3 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700"
                                                >
                                                    Allow
                                                </button>
                                            )}
                                            {model.status !== 'denied' && (
                                                <button
                                                    onClick={() => void handleDenyModel(model.modelId)}
                                                    className="px-3 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700"
                                                >
                                                    Deny
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {selectedTab === 'evaluate' && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-white">Evaluate Policy</h2>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={evaluateAgentId}
                                onChange={(e) => setEvaluateAgentId(e.target.value)}
                                placeholder="Agent ID"
                                className="flex-1 px-3 py-2 text-white placeholder-gray-500 bg-gray-800 border border-gray-600 rounded"
                            />
                            <button
                                onClick={() => void handleEvaluate()}
                                disabled={evaluating}
                                className="px-4 py-2 font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-600"
                            >
                                {evaluating ? 'Evaluating…' : 'Evaluate'}
                            </button>
                        </div>
                        {evaluationResult && (
                            <div className={`p-4 rounded-lg border ${evaluationResult.allowed ? 'bg-green-900/20 border-green-700' : 'bg-red-900/20 border-red-700'}`}>
                                <p className={`font-medium ${evaluationResult.allowed ? 'text-green-400' : 'text-red-400'}`}>
                                    {evaluationResult.allowed ? 'Allowed' : 'Blocked'}
                                </p>
                                {evaluationResult.violations.length > 0 && (
                                    <ul className="mt-2 space-y-1">
                                        {evaluationResult.violations.map((v, i) => (
                                            <li key={i} className="text-sm text-gray-300">
                                                <span className={v.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                                                    [{v.severity}]
                                                </span>{' '}
                                                {v.code}: {v.message}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {selectedTab === 'budget' && (
                    <div className="space-y-3">
                        <h2 className="text-lg font-semibold text-white">Budget Overview</h2>
                        <p className="text-sm text-gray-400">
                            Select an agent to view budget usage. Budget checks are enforced automatically during execution.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
