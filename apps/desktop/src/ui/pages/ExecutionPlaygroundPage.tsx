/**
 * ExecutionPlaygroundPage — Desktop execution playground with live DAG,
 * event timeline, and snapshot exploration.
 *
 * All state originates from streamed IPC events.
 * No execution state stored locally.
 * Cleanup on unmount.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import type {
    ExecutionStreamEvent,
    IExecutionStateResult,
    ISnapshotSummaryDTO,
    ILocalAgentListItem,
} from '@agenthub/contracts'
import { getDesktopExtendedBridge } from '../../bridges/desktop-bridge'
import type { AppView } from '../store/app-store'

interface IProps {
    onBack?: () => void
}

interface INodeState {
    id: string
    type: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    durationMs?: number
    result?: unknown
}

interface IEventEntry {
    type: string
    timestamp: string
    data: Record<string, unknown>
}

interface ITokenUsageState {
    promptTokens: number
    completionTokens: number
}

export function ExecutionPlaygroundPage({ onBack }: IProps): React.JSX.Element {
    const bridge = getDesktopExtendedBridge()
    const [agents, setAgents] = useState<readonly ILocalAgentListItem[]>([])
    const [selectedAgentId, setSelectedAgentId] = useState<string>('')
    const [inputText, setInputText] = useState('')
    const [executionId, setExecutionId] = useState<string | null>(null)
    const [isRunning, setIsRunning] = useState(false)
    const [events, setEvents] = useState<IEventEntry[]>([])
    const [nodes, setNodes] = useState<Map<string, INodeState>>(new Map())
    const [tokenUsage, setTokenUsage] = useState<ITokenUsageState>({ promptTokens: 0, completionTokens: 0 })
    const [snapshots, setSnapshots] = useState<readonly ISnapshotSummaryDTO[]>([])
    const [executionResult, setExecutionResult] = useState<unknown>(null)
    const [error, setError] = useState<string | null>(null)
    const eventCleanupRef = useRef<(() => void) | null>(null)
    const eventsEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        void bridge.agentBuilder.listLocal().then(setAgents)
        void bridge.snapshot.list().then(setSnapshots)
    }, [])

    useEffect(() => {
        eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [events])

    useEffect(() => {
        return () => {
            eventCleanupRef.current?.()
        }
    }, [])

    const handleEvent = useCallback((event: ExecutionStreamEvent) => {
        const entry: IEventEntry = {
            type: event.type,
            timestamp: event.timestamp,
            data: event as unknown as Record<string, unknown>,
        }
        setEvents(prev => [...prev, entry])

        switch (event.type) {
            case 'NodeStarted':
                setNodes(prev => {
                    const next = new Map(prev)
                    next.set(event.nodeId, { id: event.nodeId, type: event.nodeType, status: 'running' })
                    return next
                })
                break
            case 'NodeCompleted':
                setNodes(prev => {
                    const next = new Map(prev)
                    const existing = next.get(event.nodeId)
                    if (existing) {
                        next.set(event.nodeId, { ...existing, status: 'completed', durationMs: event.durationMs, result: event.result })
                    }
                    return next
                })
                break
            case 'ToolCalled':
                setEvents(prev => [...prev, { type: `Tool: ${event.toolName}`, timestamp: event.timestamp, data: event as unknown as Record<string, unknown> }])
                break
            case 'ExecutionCompleted':
                setIsRunning(false)
                setExecutionResult(event.result)
                setTokenUsage({ promptTokens: event.totalTokens, completionTokens: 0 })
                break
            case 'ExecutionFailed':
                setIsRunning(false)
                setError(event.error)
                break
            case 'SnapshotPersisted':
                void bridge.snapshot.list().then(setSnapshots)
                break
        }
    }, [])

    const handleRun = async () => {
        if (!selectedAgentId || !inputText.trim()) return

        setEvents([])
        setNodes(new Map())
        setTokenUsage({ promptTokens: 0, completionTokens: 0 })
        setError(null)
        setExecutionResult(null)

        eventCleanupRef.current?.()
        const unsub = bridge.execution.onEvent(handleEvent)
        eventCleanupRef.current = unsub

        setIsRunning(true)
        try {
            const result = await bridge.execution.start({
                agentId: selectedAgentId,
                input: { goal: inputText },
            })
            setExecutionId(result.executionId)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
            setIsRunning(false)
        }
    }

    const handleStop = async () => {
        if (!executionId) return
        await bridge.execution.stop({ executionId })
        setIsRunning(false)
    }

    const handleReplay = async (snapshotExecutionId: string) => {
        setEvents([])
        setNodes(new Map())
        setError(null)

        eventCleanupRef.current?.()
        const unsub = bridge.execution.onEvent(handleEvent)
        eventCleanupRef.current = unsub

        setIsRunning(true)
        try {
            const result = await bridge.execution.replay({
                executionId: snapshotExecutionId,
                deterministic: true,
            })
            setExecutionId(result.executionId)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
            setIsRunning(false)
        }
    }

    const nodeStatusColor = (status: string) => {
        switch (status) {
            case 'running': return 'text-[var(--color-info)] bg-[var(--color-info)]/10 border-[var(--color-info)]/30'
            case 'completed': return 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/30'
            case 'failed': return 'text-[var(--color-danger)] bg-[var(--color-danger)]/10 border-[var(--color-danger)]/30'
            default: return 'text-[var(--color-text-muted)] bg-[var(--color-surface-2)] border-[var(--color-border)]'
        }
    }

    const eventTypeColor = (type: string) => {
        if (type.includes('Failed')) return 'text-[var(--color-danger)]'
        if (type.includes('Completed')) return 'text-[var(--color-success)]'
        if (type.includes('Tool')) return 'text-[var(--color-warning)]'
        if (type.includes('Memory')) return 'text-purple-400'
        if (type.includes('Capability')) return 'text-orange-400'
        if (type.includes('Snapshot')) return 'text-cyan-400'
        return 'text-[var(--color-text-secondary)]'
    }

    return (
        <div className="flex flex-col w-full h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7-7 7 7 7" /></svg>
                    </button>
                    <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Execution Playground</h1>
                    {isRunning && <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-info)]" />}
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel — Agent selector + input */}
                <div className="flex w-72 shrink-0 flex-col border-r border-[var(--color-border)] p-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Agent</label>
                        <select
                            value={selectedAgentId}
                            onChange={(e) => setSelectedAgentId(e.target.value)}
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                        >
                            <option value="">Select agent...</option>
                            {agents.map(a => (
                                <option key={a.id} value={a.id}>{a.name} v{a.version}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Input</label>
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            rows={6}
                            placeholder="Describe the task..."
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleRun}
                            disabled={isRunning || !selectedAgentId}
                            className="flex-1 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
                        >
                            {isRunning ? 'Running...' : 'Run'}
                        </button>
                        {isRunning && (
                            <button
                                onClick={handleStop}
                                className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20"
                            >
                                Stop
                            </button>
                        )}
                    </div>

                    {error && (
                        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-3 text-xs text-[var(--color-danger)]">
                            {error}
                        </div>
                    )}

                    {executionResult !== null && (
                        <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 p-3">
                            <p className="text-xs font-medium text-[var(--color-success)] mb-1">Result</p>
                            <pre className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap overflow-auto max-h-40">
                                {JSON.stringify(executionResult, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>

                {/* Center — DAG Graph */}
                <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="border-b border-[var(--color-border)] px-4 py-2">
                        <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Execution Graph</h2>
                    </div>
                    <div className="flex-1 p-4 overflow-auto">
                        {nodes.size === 0 ? (
                            <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]">
                                Run an agent to see the execution graph
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                {Array.from(nodes.values()).map(node => (
                                    <div
                                        key={node.id}
                                        className={`rounded-lg border p-3 min-w-[160px] ${nodeStatusColor(node.status)}`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium truncate">{node.id}</span>
                                            {node.status === 'running' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-info)]" />}
                                            {node.status === 'completed' && <span className="text-[var(--color-success)]">✓</span>}
                                            {node.status === 'failed' && <span className="text-[var(--color-danger)]">✗</span>}
                                        </div>
                                        <div className="text-[10px] opacity-70">{node.type}</div>
                                        {node.durationMs !== undefined && (
                                            <div className="text-[10px] opacity-60 mt-1">{node.durationMs}ms</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel — Event timeline + stats */}
                <div className="flex w-80 shrink-0 flex-col border-l border-[var(--color-border)]">
                    {/* Token usage */}
                    <div className="border-b border-[var(--color-border)] p-4">
                        <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Token Usage</h3>
                        <div className="flex gap-4">
                            <div>
                                <span className="text-lg font-semibold text-[var(--color-text-primary)]">{tokenUsage.promptTokens}</span>
                                <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">prompt</span>
                            </div>
                            <div>
                                <span className="text-lg font-semibold text-[var(--color-text-primary)]">{tokenUsage.completionTokens}</span>
                                <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">completion</span>
                            </div>
                        </div>
                    </div>

                    {/* Event timeline */}
                    <div className="flex-1 p-4 overflow-auto">
                        <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Event Timeline</h3>
                        <div className="space-y-1">
                            {events.map((event, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs">
                                    <span className="shrink-0 text-[10px] text-[var(--color-text-muted)] tabular-nums">
                                        {new Date(event.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span className={`font-medium ${eventTypeColor(event.type)}`}>
                                        {event.type}
                                    </span>
                                </div>
                            ))}
                            <div ref={eventsEndRef} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom — Snapshot explorer */}
            <div className="border-t border-[var(--color-border)] p-4">
                <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Snapshots</h3>
                <div className="flex gap-2 overflow-x-auto">
                    {snapshots.length === 0 ? (
                        <span className="text-xs text-[var(--color-text-muted)]">No snapshots yet</span>
                    ) : snapshots.map(snap => (
                        <button
                            key={snap.executionId}
                            onClick={() => handleReplay(snap.executionId)}
                            className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                        >
                            <div className="font-medium">{snap.executionId.slice(0, 8)}...</div>
                            <div className="text-[10px] text-[var(--color-text-muted)]">
                                {new Date(snap.timestamp).toLocaleDateString()}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
