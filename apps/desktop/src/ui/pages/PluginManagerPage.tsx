/**
 * PluginManagerPage — Install, activate, deactivate, and uninstall plugins.
 * - List installed plugins with status
 * - Install new plugins from file path
 * - View plugin details (permissions, tools, skills)
 * - Activate/deactivate/uninstall plugins
 *
 * All data fetched via IPC bridge.
 */

import React, { useState, useEffect, useCallback } from 'react'
import type {
    IPluginListResult,
    IPluginDetailResult,
} from '@agenthub/contracts'
import { getDesktopExtendedBridge } from '../../bridges/desktop-bridge'

export function PluginManagerPage(): React.JSX.Element {
    const bridge = getDesktopExtendedBridge()
    const [plugins, setPlugins] = useState<IPluginListResult | null>(null)
    const [selectedPlugin, setSelectedPlugin] = useState<IPluginDetailResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [installPath, setInstallPath] = useState('')
    const [installing, setInstalling] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const list = await bridge.plugin.list()
            setPlugins(list)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void refresh() }, [])

    const handleInstall = async () => {
        if (!installPath.trim()) return
        setInstalling(true)
        try {
            await bridge.plugin.install({ pluginPath: installPath.trim() })
            setInstallPath('')
            await refresh()
        } finally {
            setInstalling(false)
        }
    }

    const handleActivate = async (pluginId: string) => {
        setActionLoading(pluginId)
        try {
            await bridge.plugin.activate(pluginId)
            await refresh()
        } finally {
            setActionLoading(null)
        }
    }

    const handleDeactivate = async (pluginId: string) => {
        setActionLoading(pluginId)
        try {
            await bridge.plugin.deactivate(pluginId)
            await refresh()
        } finally {
            setActionLoading(null)
        }
    }

    const handleUninstall = async (pluginId: string) => {
        setActionLoading(pluginId)
        try {
            await bridge.plugin.uninstall(pluginId)
            if (selectedPlugin?.id === pluginId) setSelectedPlugin(null)
            await refresh()
        } finally {
            setActionLoading(null)
        }
    }

    const handleSelect = async (pluginId: string) => {
        const detail = await bridge.plugin.get(pluginId)
        setSelectedPlugin(detail)
    }

    if (loading) {
        return <div className="p-6"><p className="text-gray-400">Loading plugins…</p></div>
    }

    return (
        <div className="flex flex-col w-full h-full">
            <div className="px-6 pt-6 pb-4 border-b border-gray-700">
                <h1 className="text-2xl font-bold text-white">Plugin Manager</h1>
                <p className="mt-1 text-sm text-gray-400">Install, manage, and configure plugins</p>
            </div>

            {/* Install bar */}
            <div className="flex gap-3 px-6 py-3 border-b border-gray-700">
                <input
                    type="text"
                    value={installPath}
                    onChange={(e) => setInstallPath(e.target.value)}
                    placeholder="Plugin path (.ahpkg)"
                    className="flex-1 px-3 py-2 text-sm text-white placeholder-gray-500 bg-gray-800 border border-gray-600 rounded"
                />
                <button
                    onClick={() => void handleInstall()}
                    disabled={installing}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-600"
                >
                    {installing ? 'Installing…' : 'Install'}
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Plugin list */}
                <div className="overflow-y-auto border-r border-gray-700 w-80">
                    {plugins && plugins.plugins.length === 0 ? (
                        <p className="p-4 text-sm text-gray-400">No plugins installed.</p>
                    ) : (
                        plugins?.plugins.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => void handleSelect(p.id)}
                                className={`w-full text-left p-4 border-b border-gray-700 hover:bg-gray-800 ${
                                    selectedPlugin?.id === p.id ? 'bg-gray-800' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-white">{p.name}</span>
                                    <span
                                        className={`px-2 py-0.5 rounded text-xs ${
                                            p.status === 'active'
                                                ? 'bg-green-900/50 text-green-400'
                                                : 'bg-gray-700 text-gray-400'
                                        }`}
                                    >
                                        {p.status}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-gray-400">v{p.version}</p>
                                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{p.description}</p>
                            </button>
                        ))
                    )}
                </div>

                {/* Plugin detail */}
                <div className="flex-1 p-6 overflow-y-auto">
                    {selectedPlugin ? (
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-white">{selectedPlugin.name}</h2>
                                    <p className="text-sm text-gray-400">v{selectedPlugin.version} · {selectedPlugin.status}</p>
                                    <p className="mt-2 text-gray-300">{selectedPlugin.description}</p>
                                </div>
                                <div className="flex gap-2">
                                    {selectedPlugin.status === 'active' ? (
                                        <button
                                            onClick={() => void handleDeactivate(selectedPlugin.id)}
                                            disabled={actionLoading === selectedPlugin.id}
                                            className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
                                        >
                                            Deactivate
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => void handleActivate(selectedPlugin.id)}
                                            disabled={actionLoading === selectedPlugin.id}
                                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                                        >
                                            Activate
                                        </button>
                                    )}
                                    <button
                                        onClick={() => void handleUninstall(selectedPlugin.id)}
                                        disabled={actionLoading === selectedPlugin.id}
                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                                    >
                                        Uninstall
                                    </button>
                                </div>
                            </div>

                            {selectedPlugin.permissions.length > 0 && (
                                <div>
                                    <h3 className="mb-2 text-sm font-semibold text-gray-300">Permissions</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedPlugin.permissions.map((perm) => (
                                            <span key={perm} className="px-2 py-1 text-xs text-gray-300 bg-gray-700 rounded">
                                                {perm}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedPlugin.tools.length > 0 && (
                                <div>
                                    <h3 className="mb-2 text-sm font-semibold text-gray-300">Tools ({selectedPlugin.tools.length})</h3>
                                    <div className="space-y-2">
                                        {selectedPlugin.tools.map((t) => (
                                            <div key={t.name} className="p-3 bg-gray-800 border border-gray-700 rounded">
                                                <p className="text-sm font-medium text-white">{t.name}</p>
                                                <p className="mt-1 text-xs text-gray-400">{t.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedPlugin.skills.length > 0 && (
                                <div>
                                    <h3 className="mb-2 text-sm font-semibold text-gray-300">Skills ({selectedPlugin.skills.length})</h3>
                                    <div className="space-y-2">
                                        {selectedPlugin.skills.map((s) => (
                                            <div key={s.name} className="p-3 bg-gray-800 border border-gray-700 rounded">
                                                <p className="text-sm font-medium text-white">{s.name}</p>
                                                <p className="mt-1 text-xs text-gray-400">{s.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="mt-12 text-center text-gray-400">Select a plugin to view details</p>
                    )}
                </div>
            </div>
        </div>
    )
}
