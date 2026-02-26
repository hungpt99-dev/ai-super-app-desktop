/**
 * WorkspaceTabs.tsx — Chrome-like tab bar for workspace management.
 *
 * Features:
 * - Tab bar at top with overflow scroll
 * - Each tab shows workspace name
 * - Close button on each tab (except default)
 * - Active indicator
 * - Add tab button
 * - Double-click to rename
 * - Drag and drop reordering
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
    onClose: () => void
    onRename: (newName: string) => void
    onDragStart: (e: React.DragEvent, index: number) => void
    onDragOver: (e: React.DragEvent, index: number) => void
    onDrop: (e: React.DragEvent, index: number) => void
    index: number
}

function Tab({ tab, isActive, onSelect, onClose, onRename, onDragStart, onDragOver, onDrop, index }: ITabProps): React.JSX.Element {
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState(tab.name)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    const handleDoubleClick = useCallback(() => {
        if (!tab.isDefault) {
            setIsEditing(true)
            setEditName(tab.name)
        }
    }, [tab.isDefault, tab.name])

    const handleRename = useCallback(() => {
        if (editName.trim() && editName !== tab.name) {
            onRename(editName.trim())
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
        onClose()
    }, [onClose])

    const handleDragStart = useCallback((e: React.DragEvent) => {
        onDragStart(e, index)
    }, [index, onDragStart])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        onDragOver(e, index)
    }, [index, onDragOver])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        onDrop(e, index)
    }, [index, onDrop])

    return (
        <div
            draggable
            className={`group flex items-center gap-1 px-3 py-1.5 rounded-t-md cursor-pointer transition-all select-none ${
                isActive
                    ? 'bg-[var(--color-surface)] border-t border-l border-r border-[var(--color-border)] -mb-px z-10'
                    : 'bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)]'
            }`}
            onClick={onSelect}
            onDoubleClick={handleDoubleClick}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={handleKeyDown}
                    className="w-24 px-1 py-0 text-xs bg-[var(--color-bg)] border border-[var(--color-accent)] rounded outline-none text-[var(--color-text-primary)]"
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <>
                    <span className={`text-xs font-medium max-w-[120px] truncate ${isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                        {tab.name}
                    </span>
                    {!tab.isDefault && (
                        <button
                            onClick={handleClose}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--color-surface-3)] transition-opacity"
                            title="Close tab"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </>
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
            className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-[var(--color-surface-3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="New workspace"
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
        </button>
    )
}

// ─── Workspace Tabs Component ─────────────────────────────────────────────────

export function WorkspaceTabs(): React.JSX.Element {
    const {
        tabs,
        currentTabId,
        loading,
        error,
        initialized,
        initialize,
        createTab,
        closeTab,
        switchTab,
        renameTab,
        reorderTabs,
    } = useWorkspaceTabsStore()

    const [dragIndex, setDragIndex] = useState<number | null>(null)

    // Initialize on mount
    useEffect(() => {
        if (!initialized) {
            initialize()
        }
    }, [initialized, initialize])

    // Create new workspace
    const handleCreateTab = useCallback(async () => {
        try {
            const name = `Workspace ${String(tabs.length + 1)}`
            await createTab(name)
        } catch {
            // Error handled in store
        }
    }, [tabs.length, createTab])

    // Close tab
    const handleCloseTab = useCallback(async (tabId: string) => {
        try {
            await closeTab(tabId)
        } catch {
            // Error handled in store
        }
    }, [closeTab])

    // Handle keyboard shortcuts
    // Use refs to avoid stale closures
    const currentTabIdRef = useRef(currentTabId)
    const tabsRef = useRef(tabs)
    const handleCreateTabRef = useRef(handleCreateTab)
    const handleCloseTabRef = useRef(handleCloseTab)
    
    useEffect(() => {
        currentTabIdRef.current = currentTabId
    }, [currentTabId])
    
    useEffect(() => {
        tabsRef.current = tabs
    }, [tabs])
    
    useEffect(() => {
        handleCreateTabRef.current = handleCreateTab
    }, [handleCreateTab])
    
    useEffect(() => {
        handleCloseTabRef.current = handleCloseTab
    }, [handleCloseTab])
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+T for new tab
            if (e.ctrlKey && e.key === 't') {
                e.preventDefault()
                handleCreateTabRef.current()
            }
            // Ctrl+W for close tab
            if (e.ctrlKey && e.key === 'w' && currentTabIdRef.current) {
                e.preventDefault()
                const currentTab = tabsRef.current.find(t => t.id === currentTabIdRef.current)
                if (currentTab && !currentTab.isDefault) {
                    handleCloseTabRef.current(currentTabIdRef.current)
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handleSwitchTab = useCallback(async (tabId: string) => {
        try {
            await switchTab(tabId)
        } catch {
            // Error handled in store
        }
    }, [switchTab])

    const handleRenameTab = useCallback(async (tabId: string, newName: string) => {
        try {
            await renameTab(tabId, newName)
        } catch {
            // Error handled in store
        }
    }, [renameTab])

    const handleDragStart = useCallback((_e: React.DragEvent, index: number) => {
        setDragIndex(index)
    }, [])

    const handleDragOver = useCallback((_e: React.DragEvent, _index: number) => {
        // Visual feedback handled by CSS
    }, [])

    const handleDrop = useCallback((_e: React.DragEvent, toIndex: number) => {
        if (dragIndex !== null && dragIndex !== toIndex) {
            reorderTabs(dragIndex, toIndex)
        }
        setDragIndex(null)
    }, [dragIndex, reorderTabs])

    // Loading state
    if (!initialized && loading) {
        return (
            <div className="flex items-center justify-center h-10 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-muted)]">Loading workspaces...</span>
            </div>
        )
    }

    // Empty state - should not happen (default workspace always exists)
    if (tabs.length === 0) {
        return (
            <div className="flex items-center justify-center h-10 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                <button
                    onClick={handleCreateTab}
                    className="text-xs text-[var(--color-accent)] hover:underline"
                >
                    Create workspace
                </button>
            </div>
        )
    }

    return (
        <div className="flex items-center h-10 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-2 gap-1 overflow-x-auto">
            {/* Tabs container with overflow scroll */}
            <div className="flex items-end gap-0.5 overflow-x-auto flex-1 scrollbar-hide">
                {tabs.map((tab, index) => (
                    <Tab
                        key={tab.id}
                        tab={tab}
                        isActive={tab.id === currentTabId}
                        onSelect={() => handleSwitchTab(tab.id)}
                        onClose={() => handleCloseTab(tab.id)}
                        onRename={(newName) => handleRenameTab(tab.id, newName)}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        index={index}
                    />
                ))}
            </div>

            {/* Spacer */}
            <div className="flex-shrink-0" />

            {/* Add tab button */}
            <AddTabButton onClick={handleCreateTab} disabled={loading} />

            {/* Error indicator */}
            {error && (
                <div 
                    className="flex-shrink-0 text-xs text-[var(--color-danger)] px-2" 
                    title={error}
                >
                    !
                </div>
            )}
        </div>
    )
}
