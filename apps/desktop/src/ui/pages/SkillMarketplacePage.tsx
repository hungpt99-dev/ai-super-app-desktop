/**
 * SkillMarketplacePage — browse prebuilt skills from the marketplace.
 */

import { useEffect, useState } from 'react'
import type { ISkillDefinitionDTO } from '@agenthub/contracts'
import { useDefinitionStore } from '../store/definition-store'
import { MarketplaceCard } from '../components/definition/MarketplaceCard'
import { ValidationPanel } from '../components/definition/ValidationPanel'

export function SkillMarketplacePage() {
    const {
        skillListings,
        marketplaceLoading,
        selectedSkillDetail,
        installResult,
        showInstallConfirm,
        fetchMarketplaceSkills,
        selectSkillDetail,
        requestInstall,
        confirmInstall,
        forceInstall,
        cancelInstall,
        clearDetail,
    } = useDefinitionStore()

    const [searchTerm, setSearchTerm] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')

    useEffect(() => {
        fetchMarketplaceSkills()
    }, [fetchMarketplaceSkills])

    const filtered = skillListings.filter((listing) => {
        const matchesSearch = !searchTerm ||
            listing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            listing.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            listing.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
        const matchesCategory = !categoryFilter || listing.category === categoryFilter
        return matchesSearch && matchesCategory
    })

    const categories = [...new Set(skillListings.map((l) => l.category))]

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--border)]">
                <h1 className="text-lg font-bold text-[var(--text-primary)]">Skill Marketplace</h1>
                <p className="text-xs text-[var(--text-secondary)]">
                    Browse and install prebuilt skills to attach to your agents.
                </p>
                <div className="flex gap-3 mt-3">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search skills..."
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-6">
                        {filtered.map((listing) => (
                            <MarketplaceCard
                                key={listing.id}
                                listing={listing}
                                onViewDetail={(id) => selectSkillDetail(id)}
                                onInstall={(id) => requestInstall('skill', id)}
                            />
                        ))}
                        {filtered.length === 0 && (
                            <p className="text-sm text-[var(--text-secondary)] col-span-2 text-center py-8">No skills found.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedSkillDetail && (
                <SkillDetailModal
                    skill={selectedSkillDetail}
                    onClose={clearDetail}
                    onInstall={() => {
                        requestInstall('skill', selectedSkillDetail.id)
                        clearDetail()
                    }}
                />
            )}

            {/* Install Confirmation Modal */}
            {showInstallConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={cancelInstall}>
                    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Confirm Installation</h2>
                        <p className="text-sm text-[var(--text-secondary)] mb-4">
                            This will validate and install the selected skill. Proceed?
                        </p>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={cancelInstall} className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--text-secondary)] rounded-lg">Cancel</button>
                            <button type="button" onClick={confirmInstall} className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90">Install</button>
                            <button type="button" onClick={forceInstall} className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-500">Force</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Install Result */}
            {installResult && (
                <div className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border p-4 ${installResult.status === 'success' ? 'bg-green-900/90 border-green-700' : 'bg-red-900/90 border-red-700'}`}>
                    <div className="flex items-start gap-2">
                        <span className={`text-sm ${installResult.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                            {installResult.status === 'success' ? '✓' : '✕'}
                        </span>
                        <p className={`text-sm flex-1 ${installResult.status === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                            {installResult.message}
                        </p>
                        <button type="button" onClick={() => useDefinitionStore.setState({ installResult: null })} className="text-xs opacity-60 hover:opacity-100">✕</button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Skill Detail Modal ─────────────────────────────────────────────────────

function SkillDetailModal({ skill, onClose, onInstall }: { skill: ISkillDefinitionDTO; onClose: () => void; onInstall: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-3 mb-4">
                    <span className="text-3xl">{skill.icon ?? '🧩'}</span>
                    <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">{skill.name}</h2>
                        <p className="text-xs text-[var(--text-secondary)]">v{skill.version} by {skill.author ?? 'Unknown'} | {skill.category}</p>
                    </div>
                </div>

                <p className="text-sm text-[var(--text-primary)] mb-4">{skill.description}</p>

                {skill.signature && (
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-green-900/20 border border-green-800">
                        <span className="text-green-400 text-xs">Signature verified</span>
                        <span className="text-[10px] font-mono text-green-500 truncate">{skill.signature}</span>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)] mb-2">Required Capabilities</h3>
                        <div className="flex flex-wrap gap-1">
                            {skill.requiredCapabilities.map((cap) => (
                                <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/20 text-purple-400 font-mono">{cap}</span>
                            ))}
                            {skill.requiredCapabilities.length === 0 && (
                                <span className="text-xs text-[var(--text-secondary)]">None</span>
                            )}
                        </div>
                    </div>

                    {skill.tools.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)] mb-2">Tools ({skill.tools.length})</h3>
                            <div className="space-y-2">
                                {skill.tools.map((tool) => (
                                    <div key={tool.name} className="px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)]">
                                        <span className="font-mono text-xs text-[var(--text-primary)]">{tool.name}</span>
                                        <p className="text-xs text-[var(--text-secondary)]">{tool.description}</p>
                                        {tool.timeoutMs && (
                                            <span className="text-[10px] text-[var(--text-secondary)]">Timeout: {tool.timeoutMs}ms</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {skill.permissions.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)] mb-2">Permissions</h3>
                            <div className="flex flex-wrap gap-1">
                                {skill.permissions.map((perm) => (
                                    <span key={perm} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg)] text-[var(--text-secondary)] font-mono">{perm}</span>
                                ))}
                            </div>
                        </div>
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
