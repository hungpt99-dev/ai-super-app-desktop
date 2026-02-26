/**
 * AgentMarketplacePage — browse prebuilt agents from the marketplace.
 * Includes install confirmation modal and detail view.
 */

import { useEffect, useState } from 'react'
import type { IAgentDefinitionDTO } from '@agenthub/contracts'
import { useDefinitionStore } from '../store/definition-store'
import { MarketplaceCard } from '../components/definition/MarketplaceCard'
import { ValidationPanel } from '../components/definition/ValidationPanel'

export function AgentMarketplacePage() {
    const {
        agentListings,
        marketplaceLoading,
        selectedAgentDetail,
        installResult,
        showInstallConfirm,
        fetchMarketplaceAgents,
        selectAgentDetail,
        requestInstall,
        confirmInstall,
        forceInstall,
        cancelInstall,
        clearDetail,
    } = useDefinitionStore()

    const [searchTerm, setSearchTerm] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')

    useEffect(() => {
        fetchMarketplaceAgents()
    }, [fetchMarketplaceAgents])

    const filtered = agentListings.filter((listing) => {
        const matchesSearch = !searchTerm ||
            listing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            listing.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            listing.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
        const matchesCategory = !categoryFilter || listing.category === categoryFilter
        return matchesSearch && matchesCategory
    })

    const categories = [...new Set(agentListings.map((l) => l.category))]

    return (
        <div className="flex flex-col w-full h-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--border)]">
                <h1 className="text-lg font-bold text-[var(--text-primary)]">Agent Marketplace</h1>
                <p className="text-xs text-[var(--text-secondary)]">
                    Browse and install prebuilt agents.
                </p>
                <div className="flex gap-3 mt-3">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search agents..."
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    >
                        <option value="">All Categories</option>
                        {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {marketplaceLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <span className="text-sm text-[var(--text-secondary)]">Loading marketplace...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
                        {filtered.map((listing) => (
                            <MarketplaceCard
                                key={listing.id}
                                listing={listing}
                                onViewDetail={(id) => selectAgentDetail(id)}
                                onInstall={(id) => requestInstall('agent', id)}
                            />
                        ))}
                        {filtered.length === 0 && (
                            <p className="text-sm text-[var(--text-secondary)] col-span-2 text-center py-8">No agents found.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedAgentDetail && (
                <AgentDetailModal
                    agent={selectedAgentDetail}
                    onClose={clearDetail}
                    onInstall={() => {
                        requestInstall('agent', selectedAgentDetail.id)
                        clearDetail()
                    }}
                />
            )}

            {/* Install Confirmation Modal */}
            {showInstallConfirm && (
                <InstallConfirmModal
                    onConfirm={confirmInstall}
                    onForce={forceInstall}
                    onCancel={cancelInstall}
                />
            )}

            {/* Install Result */}
            {installResult && (
                <InstallResultBanner
                    result={installResult}
                    onDismiss={() => useDefinitionStore.setState({ installResult: null })}
                />
            )}
        </div>
    )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function AgentDetailModal({ agent, onClose, onInstall }: { agent: IAgentDefinitionDTO; onClose: () => void; onInstall: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-3 mb-4">
                    <span className="text-3xl">{agent.icon ?? '🤖'}</span>
                    <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">{agent.name}</h2>
                        <p className="text-xs text-[var(--text-secondary)]">v{agent.version} by {agent.author ?? 'Unknown'}</p>
                    </div>
                </div>

                <p className="text-sm text-[var(--text-primary)] mb-4">{agent.description}</p>

                {agent.signature && (
                    <div className="flex items-center gap-2 px-3 py-2 mb-4 border border-green-800 rounded-lg bg-green-900/20">
                        <span className="text-xs text-green-400">Signature verified</span>
                        <span className="text-[10px] font-mono text-green-500 truncate">{agent.signature}</span>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)] mb-2">Capabilities</h3>
                        <div className="flex flex-wrap gap-1">
                            {agent.capabilities.map((cap) => (
                                <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/20 text-blue-400 font-mono">{cap}</span>
                            ))}
                        </div>
                    </div>

                    {agent.skills.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)] mb-2">Attached Skills ({agent.skills.length})</h3>
                            <div className="space-y-1">
                                {agent.skills.map((skill) => (
                                    <div key={skill.id} className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
                                        <span>{skill.icon ?? '🧩'}</span>
                                        <span>{skill.name}</span>
                                        <span className="text-[var(--text-secondary)]">v{skill.version}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {agent.tools.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)] mb-2">Tools ({agent.tools.length})</h3>
                            <div className="space-y-1">
                                {agent.tools.map((tool) => (
                                    <div key={tool.name} className="text-xs text-[var(--text-primary)]">
                                        <span className="font-mono">{tool.name}</span> — {tool.description}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)] mb-2">Memory</h3>
                        <p className="text-xs text-[var(--text-primary)]">
                            {agent.memoryConfig.enabled ? `Enabled (${agent.memoryConfig.scopes.join(', ')})` : 'Disabled'}
                        </p>
                    </div>

                    {agent.maxTokenBudget && (
                        <p className="text-xs text-[var(--text-secondary)]">Token Budget: {agent.maxTokenBudget.toLocaleString()}</p>
                    )}
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[var(--border)]">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--text-secondary)] rounded-lg hover:text-[var(--text-primary)]">Close</button>
                    <button type="button" onClick={onInstall} className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90">Install</button>
                </div>
            </div>
        </div>
    )
}

function InstallConfirmModal({ onConfirm, onForce, onCancel }: { onConfirm: () => void; onForce: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Confirm Installation</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                    This will validate and install the selected item. Proceed?
                </p>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--text-secondary)] rounded-lg">Cancel</button>
                    <button type="button" onClick={onConfirm} className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90">Install</button>
                    <button type="button" onClick={onForce} className="px-4 py-2 text-sm text-white bg-yellow-600 rounded-lg hover:bg-yellow-500" title="Overwrite existing version">Force</button>
                </div>
            </div>
        </div>
    )
}

function InstallResultBanner({ result, onDismiss }: { result: any; onDismiss: () => void }) {
    const isSuccess = result.status === 'success'
    return (
        <div className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border p-4 ${isSuccess ? 'bg-green-900/90 border-green-700' : 'bg-red-900/90 border-red-700'}`}>
            <div className="flex items-start gap-2">
                <span className={`text-sm ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
                    {isSuccess ? '✓' : '✕'}
                </span>
                <div className="flex-1">
                    <p className={`text-sm font-medium ${isSuccess ? 'text-green-300' : 'text-red-300'}`}>
                        {result.message}
                    </p>
                    {result.validationResult && !result.validationResult.valid && (
                        <ValidationPanel validation={result.validationResult} title="" />
                    )}
                </div>
                <button type="button" onClick={onDismiss} className="text-xs opacity-60 hover:opacity-100">✕</button>
            </div>
        </div>
    )
}
