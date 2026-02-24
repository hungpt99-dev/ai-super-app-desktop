/**
 * WorkspaceManagerPage — UI for managing multiple workspaces.
 *
 * Features:
 * - List all workspaces
 * - Create new workspace
 * - Delete workspace
 * - Rename workspace
 * - Switch workspace
 * - Duplicate workspace
 */

import React, { useState, useEffect } from 'react'
import { useWorkspaceStore, Workspace } from '../store/workspace-store'

interface IProps {
    readonly workspaceId: string
}

export function WorkspaceManagerPage({ workspaceId: _workspaceId }: IProps): React.JSX.Element {
    const {
        activeWorkspace,
        workspaces,
        loading,
        error,
        initialize,
        createWorkspace,
        deleteWorkspace,
        renameWorkspace,
        switchWorkspace,
        duplicateWorkspace,
        clearError,
    } = useWorkspaceStore()

    const [newWorkspaceName, setNewWorkspaceName] = useState('')
    const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

    useEffect(() => {
        void initialize()
    }, [initialize])

    const handleCreate = async () => {
        if (!newWorkspaceName.trim()) return
        try {
            await createWorkspace(newWorkspaceName.trim())
            setNewWorkspaceName('')
            setShowCreateForm(false)
        } catch {
            // Error handled in store
        }
    }

    const handleRename = async (workspaceId: string) => {
        if (!editingName.trim()) return
        try {
            await renameWorkspace(workspaceId, editingName.trim())
            setEditingWorkspaceId(null)
            setEditingName('')
        } catch {
            // Error handled in store
        }
    }

    const handleDelete = async (workspaceId: string) => {
        try {
            await deleteWorkspace(workspaceId)
            setDeleteConfirmId(null)
        } catch {
            // Error handled in store
        }
    }

    const handleSwitch = async (workspaceId: string) => {
        try {
            await switchWorkspace(workspaceId)
        } catch {
            // Error handled in store
        }
    }

    const handleDuplicate = async (workspaceId: string) => {
        const source = workspaces.find(w => w.id === workspaceId)
        if (!source) return
        try {
            await duplicateWorkspace(workspaceId, `${source.name} (Copy)`)
        } catch {
            // Error handled in store
        }
    }

    const formatDate = (timestamp: number): string => {
        return new Date(timestamp).toLocaleDateString()
    }

    return (
        <div className="flex flex-col h-full bg-gray-950">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Workspace Manager</h1>
                        <p className="mt-1 text-sm text-gray-400">Manage your isolated workspaces</p>
                    </div>
                    <button
                        onClick={() => setShowCreateForm(true)}
                        className="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                        Create Workspace
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="p-4 mx-6 mt-4 border border-red-700 rounded-lg bg-red-900/30">
                    <div className="flex items-center justify-between">
                        <span className="text-red-400">{error}</span>
                        <button
                            onClick={clearError}
                            className="text-red-400 hover:text-red-300"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                {/* Create Form */}
                {showCreateForm && (
                    <div className="p-4 mb-6 bg-gray-900 border border-gray-700 rounded-xl">
                        <h3 className="mb-4 text-lg font-semibold text-white">Create New Workspace</h3>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={newWorkspaceName}
                                onChange={(e) => setNewWorkspaceName(e.target.value)}
                                placeholder="Workspace name"
                                className="flex-1 px-4 py-2 text-white bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
                            />
                            <button
                                onClick={() => void handleCreate()}
                                disabled={!newWorkspaceName.trim() || loading}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create
                            </button>
                            <button
                                onClick={() => {
                                    setShowCreateForm(false)
                                    setNewWorkspaceName('')
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Workspace List */}
                <div className="space-y-4">
                    {workspaces.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-gray-500">No workspaces found. Create one to get started.</p>
                        </div>
                    ) : (
                        workspaces.map((workspace) => (
                            <div
                                key={workspace.id}
                                className={`p-4 bg-gray-900 border rounded-xl transition-colors ${
                                    activeWorkspace?.id === workspace.id
                                        ? 'border-blue-600'
                                        : 'border-gray-700 hover:border-gray-600'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        {editingWorkspaceId === workspace.id ? (
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    className="px-3 py-1 text-white bg-gray-800 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    onKeyDown={(e) => e.key === 'Enter' && void handleRename(workspace.id)}
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => void handleRename(workspace.id)}
                                                    className="px-3 py-1 text-sm text-green-400 hover:text-green-300"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingWorkspaceId(null)
                                                        setEditingName('')
                                                    }}
                                                    className="px-3 py-1 text-sm text-gray-400 hover:text-gray-300"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-semibold text-white">{workspace.name}</h3>
                                                    {activeWorkspace?.id === workspace.id && (
                                                        <span className="px-2 py-0.5 text-xs bg-blue-900 text-blue-400 rounded">
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-500">
                                                    Created: {formatDate(workspace.createdAt)} • Last opened: {formatDate(workspace.lastOpened)}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {deleteConfirmId === workspace.id ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-red-400">Delete?</span>
                                                <button
                                                    onClick={() => void handleDelete(workspace.id)}
                                                    className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                                                >
                                                    Confirm
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmId(null)}
                                                    className="px-3 py-1 text-sm text-gray-400 hover:text-white"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {activeWorkspace?.id !== workspace.id && (
                                                    <button
                                                        onClick={() => void handleSwitch(workspace.id)}
                                                        className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300"
                                                    >
                                                        Switch
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setEditingWorkspaceId(workspace.id)
                                                        setEditingName(workspace.name)
                                                    }}
                                                    className="px-3 py-1 text-sm text-gray-400 hover:text-white"
                                                >
                                                    Rename
                                                </button>
                                                <button
                                                    onClick={() => void handleDuplicate(workspace.id)}
                                                    className="px-3 py-1 text-sm text-gray-400 hover:text-white"
                                                >
                                                    Duplicate
                                                </button>
                                                {activeWorkspace?.id !== workspace.id && (
                                                    <button
                                                        onClick={() => setDeleteConfirmId(workspace.id)}
                                                        className="px-3 py-1 text-sm text-red-400 hover:text-red-300"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
