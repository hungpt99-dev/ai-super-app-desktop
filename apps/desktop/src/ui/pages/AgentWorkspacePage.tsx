/**
 * AgentWorkspacePage.tsx — Chat-centric workspace screen.
 * 
 * Layout:
 * - WorkspaceHeader (minimal, 48px)
 * - WorkspaceTabs (44px)
 * - Content:
 *   - Left panel: AgentsPanel (280px)
 *   - Right panel: Chat (flex-1, full height)
 * 
 * This is the main workspace view - Chat focused.
 * No Activity, No Dashboard.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useWorkspaceTabsStore, type IWorkspaceTab, type IWorkspaceAgent } from '../store/workspace-tabs-store'
import { useAgentsStore } from '../store/agents-store'
import { AgentWorkspaceTabs } from '../components/layout/AgentWorkspaceTabs'
import { ChatWindow } from '../components/panels/ChatWindow'

// ─── Minimal Workspace Header ────────────────────────────────────────────────

interface IWorkspaceHeaderProps {
    workspace: IWorkspaceTab
    agents: readonly IWorkspaceAgent[]
    onRename: (newName: string) => void
    onAddAgent: (agentId: string) => void
    onRemoveAgent: (agentId: string) => void
}

function WorkspaceHeader({
    workspace,
    agents,
    onRename,
    onAddAgent,
    onRemoveAgent,
}: IWorkspaceHeaderProps): React.JSX.Element {
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState(workspace.name)
    const [showAgentSelector, setShowAgentSelector] = useState(false)

    useEffect(() => {
        setEditName(workspace.name)
    }, [workspace.name])

    const handleDoubleClick = useCallback(() => {
        if (!workspace.isDefault) {
            setIsEditing(true)
            setEditName(workspace.name)
        }
    }, [workspace.isDefault, workspace.name])

    const handleRename = useCallback(() => {
        const trimmed = editName.trim()
        if (trimmed && trimmed !== workspace.name && trimmed.length <= 40) {
            onRename(trimmed)
        }
        setIsEditing(false)
    }, [editName, workspace.name, onRename])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRename()
        } else if (e.key === 'Escape') {
            setIsEditing(false)
            setEditName(workspace.name)
        }
    }, [handleRename, workspace.name])

    const handleBlur = useCallback(() => {
        handleRename()
    }, [handleRename])

    const toggleAgentSelector = useCallback(() => {
        setShowAgentSelector(prev => !prev)
    }, [])

    const handleAgentsApply = useCallback((selectedAgentIds: string[]) => {
        const currentAgentIds = agents.map(a => a.id)
        
        for (const agentId of selectedAgentIds) {
            if (!currentAgentIds.includes(agentId)) {
                onAddAgent(agentId)
            }
        }
        
        for (const agentId of currentAgentIds) {
            if (!selectedAgentIds.includes(agentId)) {
                onRemoveAgent(agentId)
            }
        }
        
        setShowAgentSelector(false)
    }, [agents, onAddAgent, onRemoveAgent])

    return (
        <div className="flex items-center justify-between h-12 px-4 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
            {/* Workspace Name */}
            <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-accent)]">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                {isEditing ? (
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => { setEditName(e.target.value.slice(0, 40)) } }
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        maxLength={40}
                        autoFocus
                        className="px-2 py-0.5 text-sm bg-[var(--color-bg)] border border-[var(--color-accent)] rounded outline-none text-[var(--color-text-primary)] w-40"
                    />
                ) : (
                    <span
                        className={`text-sm font-medium text-[var(--color-text-primary)] ${!workspace.isDefault ? 'cursor-pointer hover:text-[var(--color-accent)]' : ''}`}
                        onDoubleClick={handleDoubleClick}
                        title={!workspace.isDefault ? 'Double-click to rename' : 'Default workspace'}
                    >
                        {workspace.name}
                    </span>
                )}
                {workspace.isDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded">
                        Main
                    </span>
                )}
            </div>

            {/* Agents Section - Minimal */}
            <div className="flex items-center gap-2">
                {/* Agent Tags */}
                <div className="flex items-center gap-1.5">
                    {agents.map((agent) => (
                        <span
                            key={agent.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-[var(--color-surface-2)] rounded text-[var(--color-text-secondary)]"
                        >
                            {agent.name}
                            <button
                                onClick={() => { onRemoveAgent(agent.id) }}
                                className="ml-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                                title="Remove agent"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>

                {/* Add Agent Button */}
                <div className="relative">
                    <button
                        onClick={toggleAgentSelector}
                        className="px-2 py-1 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90 transition-opacity"
                    >
                        + Add Agent
                    </button>

                    {/* Agent Selector Dropdown */}
                    {showAgentSelector && (
                        <AgentSelectorDropdown
                            onApply={handleAgentsApply}
                            onCancel={() => { setShowAgentSelector(false) }}
                            existingAgentIds={agents.map(a => a.id)}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Agent Selector Dropdown ─────────────────────────────────────────────────

interface IAgentSelectorDropdownProps {
    onApply: (agentIds: string[]) => void
    onCancel: () => void
    existingAgentIds: string[]
}

function AgentSelectorDropdown({ onApply, onCancel, existingAgentIds }: IAgentSelectorDropdownProps): React.JSX.Element {
    const [selectedIds, setSelectedIds] = useState<string[]>(existingAgentIds)
    
    const { agents } = useAgentsStore()
    
    // Filter out agents already in workspace
    const availableAgents = agents.filter(a => !existingAgentIds.includes(a.id))

    const toggleAgent = useCallback((agentId: string) => {
        setSelectedIds(prev => {
            if (prev.includes(agentId)) {
                return prev.filter(id => id !== agentId)
            }
            return [...prev, agentId]
        })
    }, [])

    const handleApply = useCallback(() => {
        // Include existing agents + newly selected
        const allSelected = [...existingAgentIds, ...selectedIds]
        onApply(allSelected)
    }, [existingAgentIds, selectedIds, onApply])

    return (
        <div className="absolute top-full right-0 mt-1 w-56 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50">
            <div className="p-2 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                Select Agents
            </div>
            <div className="overflow-y-auto max-h-48">
                {availableAgents.length === 0 ? (
                    <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
                        No agents available
                    </div>
                ) : (
                    availableAgents.map((agent) => (
                        <label
                            key={agent.id}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--color-surface-2)]"
                        >
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(agent.id)}
                                onChange={() => { toggleAgent(agent.id) }}
                                className="w-4 h-4 accent-[var(--color-accent)]"
                            />
                            <span className="text-sm text-[var(--color-text-primary)]">
                                {agent.name}
                            </span>
                        </label>
                    ))
                )}
            </div>
            <div className="flex gap-2 p-2 border-t border-[var(--color-border)]">
                <button
                    onClick={handleApply}
                    className="flex-1 px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90"
                >
                    Apply
                </button>
                <button
                    onClick={onCancel}
                    className="flex-1 px-3 py-1.5 text-xs bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] rounded hover:bg-[var(--color-surface-3)]"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}

// ─── Main Agent Workspace Page ────────────────────────────────────────────────

export function AgentWorkspacePage(): React.JSX.Element {
    const {
        tabs,
        currentTabId,
        workspaceAgents,
        loading,
        initialized,
        initialize,
        createTab,
        renameTab,
        addAgent,
        removeAgent,
        error,
    } = useWorkspaceTabsStore()

    // Initialize on mount
    useEffect(() => {
        if (!initialized) {
            void initialize()
        }
    }, [initialized, initialize])

    // Get current workspace and agents
    const currentWorkspace = tabs.find(t => t.id === currentTabId) ?? tabs[0]
    const currentAgents = workspaceAgents[currentTabId] ?? []

    // Handle rename
    const handleRename = useCallback((newName: string) => {
        if (currentTabId) {
            void renameTab(currentTabId, newName)
        }
    }, [currentTabId, renameTab])

    // Handle add agent
    const handleAddAgent = useCallback((agentId: string) => {
        if (currentTabId) {
            const agentsStore = useAgentsStore.getState()
            const agent = agentsStore.agents.find(a => a.id === agentId)
            if (agent) {
                void addAgent(currentTabId, { id: agent.id, name: agent.name })
            }
        }
    }, [currentTabId, addAgent])

    // Handle remove agent
    const handleRemoveAgent = useCallback((agentId: string) => {
        if (currentTabId) {
            void removeAgent(currentTabId, agentId)
        }
    }, [currentTabId, removeAgent])

    // Loading state
    if (!initialized && loading) {
        return (
            <div className="flex items-center justify-center h-full bg-[var(--color-bg)]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-[var(--color-text-muted)]">Loading workspace...</span>
                </div>
            </div>
        )
    }

    // No workspace state
    if (tabs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 bg-[var(--color-bg)]">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-accent-dim)]">
                    <span className="text-3xl text-[var(--color-accent)]">✦</span>
                </div>
                <span className="text-[var(--color-text-muted)]">No workspace found</span>
                <button
                    onClick={() => { void createTab('Main Workspace') }}
                    className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                    Create Workspace
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full h-full overflow-hidden bg-[var(--color-bg)]">
            {/* Workspace Header - 48px */}
            <WorkspaceHeader
                workspace={currentWorkspace}
                agents={currentAgents}
                onRename={handleRename}
                onAddAgent={handleAddAgent}
                onRemoveAgent={handleRemoveAgent}
            />

            {/* Workspace Tabs - 44px */}
            <div className="flex-shrink-0">
                <AgentWorkspaceTabs />
            </div>

            {/* Content Area - Chat-focused layout - full width without left panel */}
            <div className="flex flex-1 overflow-hidden">
                {/* Right Panel - Chat (flex-1, full height) */}
                <div className="flex-1 overflow-hidden">
                    {/* Key forces remount when workspace changes - CRITICAL for workspace isolation */}
                    <ChatWindow key={currentTabId} />
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="absolute bottom-4 right-4 px-4 py-2 bg-[var(--color-danger)] text-white text-sm rounded-lg shadow-lg">
                    {error}
                </div>
            )}
        </div>
    )
}
