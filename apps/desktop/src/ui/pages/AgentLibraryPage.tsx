/**
 * AgentLibraryPage — Browse, manage, and inspect local agents.
 * - List all local agents
 * - View metadata & version history
 * - Clone, delete, open in builder
 * - Search & filter
 *
 * All data fetched via IPC bridge.
 */

import React, { useState, useEffect, useCallback } from 'react'
import type {
    IAgentDefinitionDTO,
    ILocalAgentListItem,
    IVersionRecordDTO,
} from '@agenthub/contracts'
import { getDesktopExtendedBridge } from '../../bridges/desktop-bridge'

interface IProps {
    onEditAgent: (agentId: string) => void
    onRunAgent: (agentId: string) => void
}

export function AgentLibraryPage({ onEditAgent, onRunAgent }: IProps): React.JSX.Element {
    const bridge = getDesktopExtendedBridge()
    const [agents, setAgents] = useState<readonly ILocalAgentListItem[]>([])
    const [search, setSearch] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [selectedAgent, setSelectedAgent] = useState<IAgentDefinitionDTO | null>(null)
    const [selectedVersions, setSelectedVersions] = useState<readonly IVersionRecordDTO[]>([])
    const [loading, setLoading] = useState(true)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const list = await bridge.agentBuilder.listLocal()
            setAgents(list)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void refresh() }, [])

    useEffect(() => {
        if (selectedId) {
            void bridge.agentBuilder.load(selectedId).then(result => {
                if (result) {
                    setSelectedAgent(result.agent)
                    setSelectedVersions(result.versionHistory)
                }
            })
        } else {
            setSelectedAgent(null)
            setSelectedVersions([])
        }
    }, [selectedId])

    const handleDelete = async (id: string) => {
        await bridge.agentBuilder.delete(id)
        if (selectedId === id) {
            setSelectedId(null)
        }
        setDeleteConfirmId(null)
        await refresh()
    }

    const handleClone = async (id: string) => {
        const result = await bridge.agentBuilder.load(id)
        if (result) {
            const cloned: IAgentDefinitionDTO = {
                ...result.agent,
                id: crypto.randomUUID(),
                name: `${result.agent.name} (Copy)`,
                version: '1.0.0',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
            await bridge.agentBuilder.save({ agent: cloned })
            await refresh()
        }
    }

    const filtered = agents.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.id.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="flex h-full flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
                <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Agent Library</h1>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search agents..."
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
                {/* Agent list */}
                <div className="flex-1 overflow-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {search ? 'No agents match your search.' : 'No local agents yet.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {filtered.map(agent => (
                                <div
                                    key={agent.id}
                                    onClick={() => setSelectedId(agent.id === selectedId ? null : agent.id)}
                                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                                        agent.id === selectedId
                                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                                            : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">{agent.name}</h3>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">v{agent.version}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEditAgent(agent.id) }}
                                            className="rounded px-2 py-0.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onRunAgent(agent.id) }}
                                            className="rounded px-2 py-0.5 text-xs text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
                                        >
                                            Run
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); void handleClone(agent.id) }}
                                            className="rounded px-2 py-0.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
                                        >
                                            Clone
                                        </button>
                                        {deleteConfirmId === agent.id ? (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); void handleDelete(agent.id) }}
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
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(agent.id) }}
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

                {/* Detail panel */}
                {selectedAgent && (
                    <div className="w-80 shrink-0 border-l border-[var(--color-border)] overflow-auto p-4">
                        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{selectedAgent.name}</h2>
                        <div className="space-y-3">
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">ID</span>
                                <p className="text-xs font-mono text-[var(--color-text-secondary)] break-all">{selectedAgent.id}</p>
                            </div>
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">Version</span>
                                <p className="text-sm text-[var(--color-text-primary)]">{selectedAgent.version}</p>
                            </div>
                            {selectedAgent.description && (
                                <div>
                                    <span className="text-xs text-[var(--color-text-muted)]">Description</span>
                                    <p className="text-xs text-[var(--color-text-secondary)]">{selectedAgent.description}</p>
                                </div>
                            )}
                            {selectedAgent.model && (
                                <div>
                                    <span className="text-xs text-[var(--color-text-muted)]">Model</span>
                                    <p className="text-sm text-[var(--color-text-primary)]">{selectedAgent.model}</p>
                                </div>
                            )}
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">Capabilities ({selectedAgent.capabilities.length})</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {selectedAgent.capabilities.map(cap => (
                                        <span key={cap} className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
                                            {cap}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">Skills ({selectedAgent.skills.length})</span>
                                <div className="space-y-1 mt-1">
                                    {selectedAgent.skills.map(skill => (
                                        <div key={skill.id} className="text-xs text-[var(--color-text-secondary)]">
                                            {skill.name} v{skill.version}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">Tools ({selectedAgent.tools.length})</span>
                                <div className="space-y-1 mt-1">
                                    {selectedAgent.tools.map(tool => (
                                        <div key={tool.name} className="text-xs font-mono text-[var(--color-text-secondary)]">
                                            {tool.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">Memory</span>
                                <p className="text-xs text-[var(--color-text-secondary)]">
                                    {selectedAgent.memoryConfig.enabled
                                        ? `Enabled (${selectedAgent.memoryConfig.scopes.join(', ')})`
                                        : 'Disabled'}
                                </p>
                            </div>
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">Created</span>
                                <p className="text-xs text-[var(--color-text-secondary)]">{selectedAgent.createdAt ? new Date(selectedAgent.createdAt).toLocaleString() : 'Unknown'}</p>
                            </div>

                            {selectedVersions.length > 0 && (
                                <div>
                                    <span className="text-xs text-[var(--color-text-muted)]">Version History</span>
                                    <div className="space-y-1 mt-1">
                                        {selectedVersions.map((v, i) => (
                                            <div key={i} className="rounded bg-[var(--color-surface-2)] p-1.5 text-xs text-[var(--color-text-secondary)]">
                                                v{v.version} — {v.bump} — {new Date(v.createdAt).toLocaleDateString()}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
