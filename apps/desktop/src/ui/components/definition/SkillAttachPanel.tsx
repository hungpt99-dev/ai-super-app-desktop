/**
 * SkillAttachPanel — lists available skills and allows attaching to current draft agent.
 * Shows conflict detection and capability validation.
 */

import { useEffect } from 'react'
import type { ISkillDefinitionDTO } from '@agenthub/contracts'
import { useDefinitionStore } from '../../store/definition-store'
import { MOCK_SKILL_DEFINITIONS } from '../../../mock-marketplace/data'

export function SkillAttachPanel() {
    const {
        draftAgent,
        installedSkills,
        skillListings,
        fetchMarketplaceSkills,
        attachSkillToAgent,
    } = useDefinitionStore()

    useEffect(() => {
        if (skillListings.length === 0) {
            fetchMarketplaceSkills()
        }
    }, [skillListings.length, fetchMarketplaceSkills])

    if (!draftAgent) {
        return (
            <div className="text-xs text-[var(--color-text-secondary)] p-4">
                Create or edit an agent first to attach skills.
            </div>
        )
    }

    const attachedIds = new Set(draftAgent.skills.map((s) => s.id))
    const agentCapSet = new Set(draftAgent.capabilities)

    // Combine installed + marketplace skills (deduplicated)
    const allSkills: ISkillDefinitionDTO[] = [
        ...installedSkills,
        ...MOCK_SKILL_DEFINITIONS.filter((s) => !installedSkills.some((is) => is.id === s.id)),
    ]

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Attach Skills</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
                Skills require capabilities declared on the agent. Incompatible skills show warnings.
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto">
                {allSkills.map((skill) => {
                    const isAttached = attachedIds.has(skill.id)
                    const missingCaps = skill.requiredCapabilities.filter((c) => !agentCapSet.has(c))
                    const canAttach = missingCaps.length === 0 && !isAttached

                    return (
                        <div
                            key={skill.id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                                isAttached
                                    ? 'bg-[var(--color-success)]/20 border-[var(--color-success)]/40'
                                    : missingCaps.length > 0
                                    ? 'bg-[var(--color-bg)] border-[var(--color-warning)]/50'
                                    : 'bg-[var(--color-bg)] border-[var(--color-border)]'
                            }`}
                        >
                            <span className="text-lg">{skill.icon ?? '🧩'}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-[var(--color-text-primary)]">{skill.name}</span>
                                    <span className="text-xs text-[var(--color-text-secondary)]">v{skill.version}</span>
                                    {isAttached && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-success)]/30 text-[var(--color-success)]">Attached</span>
                                    )}
                                </div>
                                <p className="text-xs text-[var(--color-text-secondary)] truncate">{skill.description}</p>
                                {missingCaps.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        <span className="text-[10px] text-[var(--color-warning)]">Missing:</span>
                                        {missingCaps.map((cap) => (
                                            <span key={cap} className="text-[10px] px-1 py-0.5 rounded bg-[var(--color-warning)]/30 text-[var(--color-warning)] font-mono">{cap}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {!isAttached && (
                                <button
                                    type="button"
                                    onClick={() => attachSkillToAgent(skill)}
                                    disabled={!canAttach}
                                    className={`px-3 py-1 text-xs rounded-lg ${
                                        canAttach
                                            ? 'bg-[var(--color-accent)] text-white hover:opacity-90'
                                            : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] opacity-50 cursor-not-allowed'
                                    }`}
                                >
                                    Attach
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
