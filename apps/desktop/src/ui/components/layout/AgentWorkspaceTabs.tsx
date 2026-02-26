/**
 * AgentWorkspaceTabs.tsx — Minimal chat-centric workspace tab bar.
 * 
 * Features:
 * - Minimal horizontal tabs
 * - Clear active workspace indicator
 * - One-click create
 * - Inline rename (double-click)
 * - Safe delete confirmation
 * - Instant switching
 * 
 * Renderer must NOT access runtime directly — all via IPC.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useWorkspaceTabsStore, type IWorkspaceTab } from '../../store/workspace-tabs-store'

// ─── Tab Component ─────────────────────────────────────────────────────────────

interface ITabProps {
    tab: IWorkspaceTab
    isActive: boolean
    onSelect: () => void
    onClose: (e: React.MouseEvent) => void
    onRename: (newName: string) => void
}

function Tab({
    tab,
    isActive,
    onSelect,
    onClose,
    onRename,
}: ITabProps): React.JSX.Element {
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState(tab.name)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    useEffect(() => {
        if (!isEditing) {
            setEditName(tab.name)
        }
    }, [tab.name, isEditing])

    const handleDoubleClick = useCallback(() => {
        if (!tab.isDefault) {
            setIsEditing(true)
            setEditName(tab.name)
        }
    }, [tab.isDefault, tab.name])

    const handleRename = useCallback(() => {
        const trimmedName = editName.trim()
        if (trimmedName && trimmedName !== tab.name) {
            onRename(trimmedName)
        }
        setIsEditing(false)
    }, [editName, tab.name, onRename])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRename()
        } else if (e.key === 'Escape') {
            setIsEditing(false)
            setEditName(tab.name)
        }
    }, [handleRename, tab.name])

    const handleClose = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        onClose(e)
    }, [onClose])

    return (
        <div
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-md cursor-pointer transition-all select-none ${
                isActive
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]'
            }`}
            onClick={onSelect}
            onDoubleClick={handleDoubleClick}
        >
            {/* Chat icon */}
            <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className={`shrink-0 ${isActive ? 'text-white' : 'text-[var(--color-text-muted)]'}`}
            >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>

            {/* Tab name or input */}
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value.slice(0, 30)) }}
                    onBlur={handleRename}
                    onKeyDown={handleKeyDown}
                    maxLength={30}
                    className="w-28 px-1.5 py-0.5 text-sm font-medium bg-white/10 border border-white/30 rounded outline-none text-inherit placeholder:text-white/50"
                    onClick={(e) => { e.stopPropagation() }}
                    placeholder="Workspace name"
                />
            ) : (
                <span className={`text-sm font-medium max-w-[120px] truncate`}>
                    {tab.name}
                </span>
            )}

            {/* Close button (hidden for default workspace) */}
            {!tab.isDefault && (
                <button
                    onClick={handleClose}
                    className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all ${
                        isActive 
                            ? 'hover:bg-white/20 text-white/70 hover:text-white' 
                            : 'hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]'
                    }`}
                    title="Close workspace"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            )}
        </div>
    )
}

// ─── Add Tab Button ────────────────────────────────────────────────────────────

interface IAddTabButtonProps {
    onClick: () => void
    disabled?: boolean
}

function AddTabButton({ onClick, disabled }: IAddTabButtonProps): React.JSX.Element {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
            title="New workspace"
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
        </button>
    )
}

// ─── Delete Confirmation Modal ─────────────────────────────────────────────────

interface IDeleteConfirmProps {
    workspaceName: string
    onConfirm: () => void
    onCancel: () => void
}

function DeleteConfirm({ workspaceName, onConfirm, onCancel }: IDeleteConfirmProps): React.JSX.Element {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-xl max-w-sm">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
                    Delete Workspace?
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-5">
                    Are you sure you want to delete <strong>"{workspaceName}"</strong>? 
                    This will permanently remove all chats in this workspace.
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] rounded-lg hover:bg-[var(--color-surface-3)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--color-danger)] rounded-lg hover:opacity-90 transition-opacity"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Agent Workspace Tabs Component ─────────────────────────────────────────────

export function AgentWorkspaceTabs(): React.JSX.Element {
    const {
        tabs,
        currentTabId,
        initialized,
        initialize,
        createTab,
        closeTab,
        switchTab,
        renameTab,
    } = useWorkspaceTabsStore()

    const [tabToDelete, setTabToDelete] = useState<IWorkspaceTab | null>(null)

    // Only initialize if not already initialized
    // The store handles mutex to prevent concurrent initialization
    useEffect(() => {
        if (!initialized) {
            initialize().catch(console.error)
        }
    }, [initialized])

    // Create new workspace
    const handleCreateTab = useCallback(async () => {
        const tabCount = tabs.length
        const name = `Workspace ${String(tabCount + 1)}`
        await createTab(name)
    }, [tabs.length, createTab])

    // Switch workspace
    const handleSwitchTab = useCallback(async (tabId: string) => {
        await switchTab(tabId)
    }, [switchTab])

    // Rename workspace
    const handleRenameTab = useCallback(async (tabId: string, newName: string) => {
        await renameTab(tabId, newName)
    }, [renameTab])

    // Handle delete confirmation
    const handleDeleteConfirm = useCallback(() => {
        if (tabToDelete) {
            closeTab(tabToDelete.id).catch(console.error)
            setTabToDelete(null)
        }
    }, [tabToDelete, closeTab])

    const handleDeleteCancel = useCallback(() => {
        setTabToDelete(null)
    }, [])

    // Loading state
    if (!initialized) {
        return (
            <div className="flex items-center h-11 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4">
                <span className="text-sm text-[var(--color-text-muted)]">Loading...</span>
            </div>
        )
    }

    // Empty state
    if (tabs.length === 0) {
        return (
            <div className="flex items-center justify-between h-11 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4">
                <span className="text-sm text-[var(--color-text-muted)]">No workspaces</span>
                <button
                    onClick={() => { void handleCreateTab() }}
                    className="text-sm text-[var(--color-accent)] hover:underline"
                >
                    Create workspace
                </button>
            </div>
        )
    }

    return (
        <div className="relative flex items-center h-11 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
            {/* Tabs container */}
            <div className="flex items-center flex-1 gap-1 px-2 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => (
                    <Tab
                        key={tab.id}
                        tab={tab}
                        isActive={tab.id === currentTabId}
                        onSelect={() => { void handleSwitchTab(tab.id) }}
                        onClose={(e) => {
                            e.stopPropagation()
                            if (!tab.isDefault) {
                                setTabToDelete(tab)
                            }
                        }}
                        onRename={(newName) => { void handleRenameTab(tab.id, newName) }}
                    />
                ))}
            </div>

            {/* Add tab button */}
            <div className="pr-2">
                <AddTabButton 
                    onClick={() => { void handleCreateTab() }}
                />
            </div>

            {/* Delete confirmation modal */}
            {tabToDelete && (
                <DeleteConfirm
                    workspaceName={tabToDelete.name}
                    onConfirm={handleDeleteConfirm}
                    onCancel={handleDeleteCancel}
                />
            )}
        </div>
    )
}
