/**
 * SnapshotManagerPage — Browse, inspect, and replay execution snapshots.
 * - List all snapshots with filters by agent
 * - View snapshot details (agent state, graph state, memory state)
 * - Delete snapshots
 * - Replay from snapshot
 *
 * All data fetched via IPC bridge.
 */

import React, { useState, useEffect, useCallback } from 'react'
import type {
    ISnapshotSummaryDTO,
    ISnapshotDTO,
} from '@agenthub/contracts'
import { getDesktopExtendedBridge } from '../../bridges/desktop-bridge'

interface IProps {
    onReplayStarted: (executionId: string) => void
}

export function SnapshotManagerPage({ onReplayStarted }: IProps): React.JSX.Element {
    const bridge = getDesktopExtendedBridge()
    const [snapshots, setSnapshots] = useState<readonly ISnapshotSummaryDTO[]>([])
    const [search, setSearch] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [selectedSnapshot, setSelectedSnapshot] = useState<ISnapshotDTO | null>(null)
    const [loading, setLoading] = useState(true)
    const [detailTab, setDetailTab] = useState<'agent' | 'graph' | 'memory' | 'execution'>('agent')
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const [replaying, setReplaying] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const list = await bridge.snapshot.list()
            setSnapshots(list)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void refresh() }, [])

    useEffect(() => {
        if (selectedId) {
            void bridge.snapshot.load(selectedId).then(record => {
                setSelectedSnapshot(record)
            })
        } else {
            setSelectedSnapshot(null)
        }
    }, [selectedId])

    const handleDelete = async (executionId: string) => {
        await bridge.snapshot.delete(executionId)
        if (selectedId === executionId) {
            setSelectedId(null)
        }
        setDeleteConfirmId(null)
        await refresh()
    }

    const handleReplay = async (executionId: string) => {
        setReplaying(executionId)
        try {
            const result = await bridge.snapshot.replay({ executionId, deterministic: true })
            if (result.executionId) {
                onReplayStarted(result.executionId)
            }
        } finally {
            setReplaying(null)
        }
    }

    const filtered = snapshots.filter(s =>
        s.agentId.toLowerCase().includes(search.toLowerCase()) ||
        s.executionId.toLowerCase().includes(search.toLowerCase())
    )

    const formatDate = (iso: string) => {
        const d = new Date(iso)
        return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
    }

    return (
        <div className="flex h-full flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
                <div>
                    <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Snapshot Manager</h1>
                    <p className="text-xs text-[var(--color-text-muted)]">{snapshots.length} snapshots stored</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search by agent or execution ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
                    />
                    <button
                        onClick={refresh}
                        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Snapshot list */}
                <div className="w-96 shrink-0 border-r border-[var(--color-border)] overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {search ? 'No snapshots match your search.' : 'No snapshots yet. Run an agent to create one.'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--color-border)]">
                            {filtered.map(snap => (
                                <div
                                    key={snap.executionId}
                                    onClick={() => setSelectedId(snap.executionId === selectedId ? null : snap.executionId)}
                                    className={`cursor-pointer p-4 transition-colors ${
                                        snap.executionId === selectedId
                                            ? 'bg-[var(--color-accent)]/5'
                                            : 'hover:bg-[var(--color-surface-2)]'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-mono text-[var(--color-text-primary)] truncate">{snap.executionId}</p>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                                Agent: {snap.agentId.slice(0, 12)}...
                                            </p>
                                            <p className="text-xs text-[var(--color-text-muted)]">
                                                {snap.snapshotCount} snapshots — {formatDate(snap.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); void handleReplay(snap.executionId) }}
                                            disabled={replaying === snap.executionId}
                                            className="rounded px-2 py-0.5 text-xs text-[var(--color-success)] hover:bg-[var(--color-success)]/10 disabled:opacity-50"
                                        >
                                            {replaying === snap.executionId ? 'Replaying...' : 'Replay'}
                                        </button>
                                        {deleteConfirmId === snap.executionId ? (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); void handleDelete(snap.executionId) }}
                                                    className="rounded px-2 py-0.5 text-xs text-[var(--color-danger)] font-medium hover:bg-[var(--color-danger)]/10"
                                                >
                                                    Confirm
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null) }}
                                                    className="rounded px-2 py-0.5 text-xs text-[var(--color-text-muted)]"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(snap.executionId) }}
                                                className="rounded px-2 py-0.5 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Detail view */}
                <div className="flex-1 overflow-auto">
                    {!selectedSnapshot ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-sm text-[var(--color-text-muted)]">Select a snapshot to view details</p>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            {/* Detail tabs */}
                            <div className="flex border-b border-[var(--color-border)] px-4">
                                {(['agent', 'graph', 'memory', 'execution'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setDetailTab(t)}
                                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                            detailTab === t
                                                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                                                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                                        }`}
                                    >
                                        {t.charAt(0).toUpperCase() + t.slice(1)} State
                                    </button>
                                ))}
                            </div>

                            {/* Detail content */}
                            <div className="flex-1 overflow-auto p-4">
                                <div className="mb-4 space-y-1">
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        Execution: <span className="font-mono text-[var(--color-text-secondary)]">{selectedSnapshot.executionId}</span>
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        Agent: <span className="font-mono text-[var(--color-text-secondary)]">{selectedSnapshot.agentId}</span>
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        Node: <span className="text-[var(--color-text-secondary)]">{selectedSnapshot.nodePointer}</span>
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        Time: <span className="text-[var(--color-text-secondary)]">{formatDate(selectedSnapshot.timestamp)}</span>
                                    </p>
                                </div>

                                {detailTab === 'agent' && (
                                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                        <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Variables</h3>
                                        <pre className="text-xs text-[var(--color-text-secondary)] overflow-auto font-mono whitespace-pre-wrap max-h-96">
                                            {JSON.stringify(selectedSnapshot.variables, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {detailTab === 'graph' && (
                                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                        <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Call Stack</h3>
                                        <pre className="text-xs text-[var(--color-text-secondary)] overflow-auto font-mono whitespace-pre-wrap max-h-96">
                                            {JSON.stringify(selectedSnapshot.callStack, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {detailTab === 'memory' && (
                                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                        <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Memory References</h3>
                                        <pre className="text-xs text-[var(--color-text-secondary)] overflow-auto font-mono whitespace-pre-wrap max-h-96">
                                            {JSON.stringify(selectedSnapshot.memoryReferences, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {detailTab === 'execution' && (
                                    <div className="space-y-4">
                                        {selectedSnapshot.providerRawResponse && (
                                            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                                <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Provider Raw Response</h3>
                                                <pre className="text-xs text-[var(--color-text-secondary)] overflow-auto font-mono whitespace-pre-wrap max-h-64">
                                                    {JSON.stringify(selectedSnapshot.providerRawResponse, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                            <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Node Pointer</h3>
                                            <p className="text-xs font-mono text-[var(--color-text-secondary)]">{selectedSnapshot.nodePointer}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
