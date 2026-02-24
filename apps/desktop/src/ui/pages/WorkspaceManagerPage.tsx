/**
 * WorkspaceManagerPage — Create, switch, and delete workspaces.
 * - List all workspaces with current indicator
 * - Create new workspace
 * - Switch active workspace
 * - Delete non-default workspaces
 *
 * All data fetched via IPC bridge.
 */

import React, { useState, useEffect, useCallback } from 'react'
import type {
    IWorkspaceResult,
    IWorkspaceListResult,
} from '@agenthub/contracts'
import { getDesktopExtendedBridge } from '../../bridges/desktop-bridge'

interface IProps {
    onWorkspaceSwitched?: (workspaceId: string) => void
}

export function WorkspaceManagerPage({ onWorkspaceSwitched }: IProps): React.JSX.Element {
    const bridge = getDesktopExtendedBridge()
    const [workspaces, setWorkspaces] = useState<IWorkspaceListResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [newName, setNewName] = useState('')
    const [creating, setCreating] = useState(false)
    const [switching, setSwitching] = useState<string | null>(null)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const list = await bridge.workspace.list()
            setWorkspaces(list)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void refresh() }, [])

    const handleCreate = async () => {
        if (!newName.trim()) return
        setCreating(true)
        try {
            await bridge.workspace.create({ name: newName.trim() })
            setNewName('')
            await refresh()
        } finally {
            setCreating(false)
        }
    }

    const handleSwitch = async (workspaceId: string) => {
        setSwitching(workspaceId)
        try {
            await bridge.workspace.switch(workspaceId)
            await refresh()
            onWorkspaceSwitched?.(workspaceId)
        } finally {
            setSwitching(null)
        }
    }

    const handleDelete = async (workspaceId: string) => {
        await bridge.workspace.delete(workspaceId)
        setDeleteConfirmId(null)
        await refresh()
    }

    if (loading) {
        return <div className="p-6"><p className="text-gray-400">Loading workspaces…</p></div>
    }

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 pt-6 pb-4 border-b border-gray-700">
                <h1 className="text-2xl font-bold text-white">Workspace Manager</h1>
                <p className="text-gray-400 text-sm mt-1">Isolated environments for agents, memory, and configuration</p>
            </div>

            {/* Create bar */}
            <div className="px-6 py-3 border-b border-gray-700 flex gap-3">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Workspace name"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 text-sm"
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate() }}
                />
                <button
                    onClick={() => void handleCreate()}
                    disabled={creating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-medium text-sm"
                >
                    {creating ? 'Creating…' : 'Create'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {workspaces && workspaces.workspaces.length === 0 ? (
                    <p className="text-gray-400">No workspaces found.</p>
                ) : (
                    <div className="grid gap-3">
                        {workspaces?.workspaces.map((ws) => (
                            <div
                                key={ws.id}
                                className={`p-4 rounded-lg border ${
                                    ws.id === workspaces?.currentWorkspaceId
                                        ? 'bg-blue-900/20 border-blue-700'
                                        : 'bg-gray-800 border-gray-700'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-white font-medium">{ws.name}</h3>
                                            {ws.id === workspaces?.currentWorkspaceId && (
                                                <span className="px-2 py-0.5 bg-blue-600 rounded text-xs text-white">Active</span>
                                            )}
                                            {ws.isDefault && (
                                                <span className="px-2 py-0.5 bg-gray-600 rounded text-xs text-gray-300">Default</span>
                                            )}
                                        </div>
                                        <p className="text-gray-400 text-xs mt-1">
                                            ID: {ws.id} · Created: {new Date(ws.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        {ws.id !== workspaces?.currentWorkspaceId && (
                                            <button
                                                onClick={() => void handleSwitch(ws.id)}
                                                disabled={switching === ws.id}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-sm"
                                            >
                                                {switching === ws.id ? 'Switching…' : 'Switch'}
                                            </button>
                                        )}
                                        {!ws.isDefault && (
                                            deleteConfirmId === ws.id ? (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => void handleDelete(ws.id)}
                                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                                                    >
                                                        Confirm
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirmId(null)}
                                                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setDeleteConfirmId(ws.id)}
                                                    className="px-3 py-1.5 bg-red-600/50 hover:bg-red-600 text-white rounded text-sm"
                                                >
                                                    Delete
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
