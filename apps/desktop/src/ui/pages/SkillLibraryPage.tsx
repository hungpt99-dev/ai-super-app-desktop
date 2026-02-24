/**
 * SkillLibraryPage — Browse, manage, and inspect local skills.
 * - List all local skills
 * - View metadata & version history
 * - Clone, delete, open in builder
 * - Search & filter by type
 *
 * All data fetched via IPC bridge.
 */

import React, { useState, useEffect, useCallback } from 'react'
import type {
    ISkillDefinitionDTO,
    ILocalSkillListItem,
    IVersionRecordDTO,
} from '@agenthub/contracts'
import { getDesktopExtendedBridge } from '../../bridges/desktop-bridge'

const SKILL_TYPE_LABELS: Record<string, string> = {
    llm_prompt: 'LLM Prompt',
    tool_wrapper: 'Tool Wrapper',
    graph_fragment: 'Graph Fragment',
}

interface IProps {
    onEditSkill: (skillId: string) => void
}

export function SkillLibraryPage({ onEditSkill }: IProps): React.JSX.Element {
    const bridge = getDesktopExtendedBridge()
    const [skills, setSkills] = useState<readonly ILocalSkillListItem[]>([])
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [selectedSkill, setSelectedSkill] = useState<ISkillDefinitionDTO | null>(null)
    const [selectedVersions, setSelectedVersions] = useState<readonly IVersionRecordDTO[]>([])
    const [loading, setLoading] = useState(true)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const list = await bridge.skillBuilder.listLocal()
            setSkills(list)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void refresh() }, [])

    useEffect(() => {
        if (selectedId) {
            void bridge.skillBuilder.load(selectedId).then(result => {
                if (result) {
                    setSelectedSkill(result.skill)
                    setSelectedVersions(result.versionHistory)
                }
            })
        } else {
            setSelectedSkill(null)
            setSelectedVersions([])
        }
    }, [selectedId])

    const handleDelete = async (id: string) => {
        await bridge.skillBuilder.delete(id)
        if (selectedId === id) {
            setSelectedId(null)
        }
        setDeleteConfirmId(null)
        await refresh()
    }

    const handleClone = async (id: string) => {
        const result = await bridge.skillBuilder.load(id)
        if (result) {
            const cloned: ISkillDefinitionDTO = {
                ...result.skill,
                id: crypto.randomUUID(),
                name: `${result.skill.name} (Copy)`,
                version: '1.0.0',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
            await bridge.skillBuilder.save({ skill: cloned })
            await refresh()
        }
    }

    const filtered = skills.filter(s => {
        const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.id.toLowerCase().includes(search.toLowerCase())
        const matchType = !typeFilter || s.type === typeFilter
        return matchSearch && matchType
    })

    return (
        <div className="flex h-full flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
                <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Skill Library</h1>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search skills..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
                    />
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)]"
                    >
                        <option value="">All types</option>
                        <option value="llm_prompt">LLM Prompt</option>
                        <option value="tool_wrapper">Tool Wrapper</option>
                        <option value="graph_fragment">Graph Fragment</option>
                    </select>
                    <button
                        onClick={refresh}
                        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Skill list */}
                <div className="flex-1 overflow-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {search || typeFilter ? 'No skills match your filters.' : 'No local skills yet.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {filtered.map(skill => (
                                <div
                                    key={skill.id}
                                    onClick={() => setSelectedId(skill.id === selectedId ? null : skill.id)}
                                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                                        skill.id === selectedId
                                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                                            : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">{skill.name}</h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-[var(--color-text-muted)]">v{skill.version}</span>
                                                <span className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs text-[var(--color-text-muted)]">
                                                    {SKILL_TYPE_LABELS[skill.type] ?? skill.type}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEditSkill(skill.id) }}
                                            className="rounded px-2 py-0.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); void handleClone(skill.id) }}
                                            className="rounded px-2 py-0.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
                                        >
                                            Clone
                                        </button>
                                        {deleteConfirmId === skill.id ? (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); void handleDelete(skill.id) }}
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
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(skill.id) }}
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
                {selectedSkill && (
                    <div className="w-80 shrink-0 border-l border-[var(--color-border)] overflow-auto p-4">
                        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{selectedSkill.name}</h2>
                        <div className="space-y-3">
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">ID</span>
                                <p className="text-xs font-mono text-[var(--color-text-secondary)] break-all">{selectedSkill.id}</p>
                            </div>
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">Type</span>
                                <p className="text-sm text-[var(--color-text-primary)]">
                                    {SKILL_TYPE_LABELS[selectedSkill.type ?? ''] ?? selectedSkill.type ?? 'unknown'}
                                </p>
                            </div>
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">Version</span>
                                <p className="text-sm text-[var(--color-text-primary)]">{selectedSkill.version}</p>
                            </div>
                            {selectedSkill.description && (
                                <div>
                                    <span className="text-xs text-[var(--color-text-muted)]">Description</span>
                                    <p className="text-xs text-[var(--color-text-secondary)]">{selectedSkill.description}</p>
                                </div>
                            )}
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">Capabilities ({selectedSkill.requiredCapabilities.length})</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {selectedSkill.requiredCapabilities.map((cap: string) => (
                                        <span key={cap} className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
                                            {cap}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">Input Schema</span>
                                <pre className="mt-1 rounded bg-[var(--color-surface-2)] p-2 text-xs text-[var(--color-text-secondary)] overflow-auto max-h-32 font-mono">
                                    {JSON.stringify(selectedSkill.inputSchema, null, 2)}
                                </pre>
                            </div>
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">Output Schema</span>
                                <pre className="mt-1 rounded bg-[var(--color-surface-2)] p-2 text-xs text-[var(--color-text-secondary)] overflow-auto max-h-32 font-mono">
                                    {JSON.stringify(selectedSkill.outputSchema, null, 2)}
                                </pre>
                            </div>
                            <div>
                                <span className="text-xs text-[var(--color-text-muted)]">Created</span>
                                <p className="text-xs text-[var(--color-text-secondary)]">{selectedSkill.createdAt ? new Date(selectedSkill.createdAt).toLocaleString() : 'Unknown'}</p>
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
