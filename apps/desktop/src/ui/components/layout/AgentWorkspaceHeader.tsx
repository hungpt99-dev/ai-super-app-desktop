/**
 * AgentWorkspaceHeader.tsx — Header showing active workspace and agents.
 *
 * Features:
 * - Shows current workspace name
 * - Lists agents in workspace
 * - Add agent button
 * - Remove agent button
 *
 * Renderer must NOT access runtime directly — all via IPC.
 */

import React, { useCallback, useState, useEffect } from 'react'
import { useWorkspaceTabsStore } from '../../store/workspace-tabs-store'
import { useAgentsStore, type IDesktopAgent } from '../../store/agents-store'

interface IAgentWorkspaceHeaderProps {
    className?: string
}

export function AgentWorkspaceHeader({ className = '' }: IAgentWorkspaceHeaderProps): React.JSX.Element {
    const {
        currentTabId,
        workspaceAgents,
        getActiveWorkspace,
        addAgent,
        removeAgent,
        initialized,
    } = useWorkspaceTabsStore()

    const { agents } = useAgentsStore()
    const [showAgentPicker, setShowAgentPicker] = useState(false)

    // Wait for workspace to be initialized
    const activeWorkspace = getActiveWorkspace()
    const currentAgentIds = currentTabId ? (workspaceAgents[currentTabId] ?? []).map(a => a.id) : []
    const currentAgents = agents.filter(a => currentAgentIds.includes(a.id))
    const availableAgents = agents.filter(a => !currentAgentIds.includes(a.id))

    // Close picker on outside click
    useEffect(() => {
        if (!showAgentPicker) return

        const handleClick = () => { setShowAgentPicker(false) }
        document.addEventListener('click', handleClick)
        return () => { document.removeEventListener('click', handleClick) }
    }, [showAgentPicker])

    const handleAddAgent = useCallback(async (agent: IDesktopAgent) => {
        if (!currentTabId) return
        try {
            await addAgent(currentTabId, { id: agent.id, name: agent.name })
            setShowAgentPicker(false)
        } catch {
            // Error handled in store
        }
    }, [currentTabId, addAgent])

    const handleRemoveAgent = useCallback(async (agentId: string) => {
        if (!currentTabId) return
        try {
            await removeAgent(currentTabId, agentId)
        } catch {
            // Error handled in store
        }
    }, [currentTabId, removeAgent])

    if (!initialized) {
        return <div className={`flex items-center gap-4 px-4 py-2 bg-[var(--color-surface-2)] border-b border-[var(--color-border)] ${className}`}>
            <span className="text-xs text-[var(--color-text-muted)]">Loading...</span>
        </div>
    }

    return (
        <div className={`flex items-center gap-4 px-4 py-2 bg-[var(--color-surface-2)] border-b border-[var(--color-border)] ${className}`}>
            {/* Workspace name */}
            <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-accent)]">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {activeWorkspace.name}
                </span>
                {activeWorkspace.isDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded">
                        Main
                    </span>
                )}
            </div>

            {/* Divider */}
            <div className="h-4 w-px bg-[var(--color-border)]" />

            {/* Agents in workspace */}
            <div className="flex items-center flex-1 gap-2 overflow-hidden">
                <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                    Agents:
                </span>

                {currentAgents.length === 0 ? (
                    <span className="text-xs text-[var(--color-text-muted)]">
                        No agents in workspace
                    </span>
                ) : (
                    <div className="flex items-center gap-1 overflow-x-auto">
                        {currentAgents.map(agent => (
                            <div
                                key={agent.id}
                                className="flex items-center gap-1 px-2 py-1 bg-[var(--color-surface)] rounded-md text-xs"
                            >
                                <span className="text-[var(--color-text-primary)] truncate max-w-[100px]">
                                    {agent.name}
                                </span>
                                <button
                                    onClick={() => { void handleRemoveAgent(agent.id) }}
                                    className="p-0.5 hover:bg-[var(--color-surface-3)] rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                                    title="Remove from workspace"
                                >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add agent button */}
            <div className="relative">
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        setShowAgentPicker(!showAgentPicker)
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--color-accent)] hover:bg-[var(--color-surface)] rounded transition-colors"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Agent
                </button>

                {/* Agent picker dropdown */}
                {showAgentPicker && (
                    <div className="absolute top-full right-0 mt-1 w-64 max-h-64 overflow-y-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50">
                        {availableAgents.length === 0 ? (
                            <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
                                No more agents available
                            </div>
                        ) : (
                            <div className="p-1">
                                {availableAgents.map(agent => (
                                    <button
                                        key={agent.id}
                                        onClick={() => { void handleAddAgent(agent) }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-[var(--color-surface-2)] rounded text-xs"
                                    >
                                        <span className="text-[var(--color-text-primary)]">{agent.name}</span>
                                        <span className="text-[var(--color-text-muted)] truncate">
                                            {agent.description}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
