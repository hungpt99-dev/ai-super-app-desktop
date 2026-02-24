/**
 * SkillForm — form for creating/editing a skill definition.
 * All logic delegated to SDK via definition store.
 */

import { useState, useCallback } from 'react'
import type { ISkillDefinitionDTO, IToolConfigDTO } from '@agenthub/contracts'
import { useDefinitionStore } from '../../store/definition-store'
import { CapabilitySelector } from './CapabilitySelector'
import { ValidationPanel } from './ValidationPanel'

const CATEGORIES = ['productivity', 'developer', 'creative', 'finance', 'education', 'utilities', 'general'] as const

function defaultSkill(): ISkillDefinitionDTO {
    return {
        id: crypto.randomUUID(),
        name: '',
        version: '1.0.0',
        description: '',
        requiredCapabilities: [],
        permissions: [],
        tools: [],
        category: 'general',
        createdAt: new Date().toISOString(),
    }
}

export function SkillForm() {
    const {
        draftSkill,
        draftSkillValidation,
        updateDraftSkill,
        saveSkillLocally,
    } = useDefinitionStore()

    const skill = draftSkill ?? defaultSkill()

    const update = useCallback(
        (partial: Partial<ISkillDefinitionDTO>) => {
            updateDraftSkill({ ...skill, ...partial, updatedAt: new Date().toISOString() } as ISkillDefinitionDTO)
        },
        [skill, updateDraftSkill],
    )

    // ── Tool editor ──────────────────────────────────────────────────────
    const [newToolName, setNewToolName] = useState('')
    const [newToolDesc, setNewToolDesc] = useState('')

    function addTool() {
        if (!newToolName.trim() || !newToolDesc.trim()) return
        const tool: IToolConfigDTO = {
            name: newToolName.trim(),
            description: newToolDesc.trim(),
            inputSchema: { type: 'object', properties: {} },
            timeoutMs: 30000,
        }
        update({ tools: [...skill.tools, tool] })
        setNewToolName('')
        setNewToolDesc('')
    }

    function removeTool(idx: number) {
        update({ tools: skill.tools.filter((_, i) => i !== idx) })
    }

    function handleSave() {
        saveSkillLocally(skill)
    }

    return (
        <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Skill Information</h3>
                <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name *</label>
                    <input
                        type="text"
                        value={skill.name}
                        onChange={(e) => update({ name: e.target.value })}
                        placeholder="My Custom Skill"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Version *</label>
                        <input
                            type="text"
                            value={skill.version}
                            onChange={(e) => update({ version: e.target.value })}
                            placeholder="1.0.0"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Category *</label>
                        <select
                            value={skill.category}
                            onChange={(e) => update({ category: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        >
                            {CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description *</label>
                    <textarea
                        value={skill.description}
                        onChange={(e) => update({ description: e.target.value })}
                        rows={3}
                        placeholder="What does this skill do?"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Author</label>
                        <input
                            type="text"
                            value={skill.author ?? ''}
                            onChange={(e) => update({ author: e.target.value || undefined })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Icon (emoji)</label>
                        <input
                            type="text"
                            value={skill.icon ?? ''}
                            onChange={(e) => update({ icon: e.target.value || undefined })}
                            maxLength={4}
                            className="w-20 px-3 py-2 text-sm text-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        />
                    </div>
                </div>
            </div>

            {/* Required Capabilities */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Required Capabilities</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                    Capabilities that an agent must declare to use this skill.
                </p>
                <CapabilitySelector
                    selected={skill.requiredCapabilities}
                    onChange={(caps) => update({ requiredCapabilities: caps, permissions: caps })}
                />
            </div>

            {/* Tools */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Tools</h3>
                {skill.tools.length > 0 && (
                    <div className="space-y-2">
                        {skill.tools.map((tool, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                                <div className="flex-1 min-w-0">
                                    <span className="font-mono text-xs text-[var(--color-text-primary)]">{tool.name}</span>
                                    <p className="text-xs text-[var(--color-text-secondary)] truncate">{tool.description}</p>
                                </div>
                                <button type="button" onClick={() => removeTool(idx)} className="text-[var(--color-danger)] hover:opacity-80 text-xs px-2 py-1">
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex gap-2">
                    <input type="text" value={newToolName} onChange={(e) => setNewToolName(e.target.value)} placeholder="Tool name" className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
                    <input type="text" value={newToolDesc} onChange={(e) => setNewToolDesc(e.target.value)} placeholder="Tool description" className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
                    <button type="button" onClick={addTool} className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90">Add</button>
                </div>
            </div>

            {/* Validation */}
            <ValidationPanel validation={draftSkillValidation} title="Skill Validation" />

            {/* JSON Preview */}
            <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                <summary className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] cursor-pointer">JSON Preview</summary>
                <pre className="px-4 py-3 text-xs text-[var(--color-text-secondary)] overflow-auto max-h-64 border-t border-[var(--color-border)]">
                    {JSON.stringify(skill, null, 2)}
                </pre>
            </details>

            {/* Save */}
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!draftSkillValidation?.valid}
                    className="px-6 py-2 text-sm bg-[var(--color-success)] text-white rounded-lg hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    Save Skill
                </button>
            </div>
        </div>
    )
}
