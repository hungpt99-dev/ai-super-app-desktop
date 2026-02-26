/**
 * SkillEditorPage — Unified skill creation/editing page.
 * 
 * Combines CreateSkillPage and SkillBuilderPage into a single page.
 * Uses mode: 'create' | 'edit' based on presence of skillId.
 * 
 * Architecture:
 * - Pages only compose components (RULE 1)
 * - All logic in hooks (RULE 3)
 * - No bridge calls in page (RULE 5)
 */

import React from 'react'
import { useSkillBuilder, SKILL_TYPES, CAPABILITIES, type SkillTab } from '../hooks/use-skill-builder'

interface IProps {
    skillId?: string
    onBack: () => void
}

const TAB_OPTIONS: SkillTab[] = ['basic', 'capabilities', 'schema', 'prompt']

export function SkillEditorPage({ skillId, onBack }: IProps): React.JSX.Element {
    const {
        skill,
        validation,
        versionHistory,
        saving,
        saved,
        tab,
        update,
        handleValidate,
        handleSave,
        toggleCapability,
        setTab,
        errorCount,
        warnCount,
        isEditMode,
    } = useSkillBuilder({ skillId })

    const handleSchemaChange = (field: 'inputSchema' | 'outputSchema', value: string) => {
        try {
            const parsed = JSON.parse(value) as Record<string, unknown>
            update({ [field]: parsed })
        } catch {
            /* invalid json, ignore until valid */
        }
    }

    return (
        <div className="flex flex-col w-full h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7-7 7 7 7" /></svg>
                    </button>
                    <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {isEditMode ? 'Edit Skill' : 'Skill Builder'}
                    </h1>
                    <span className="text-xs text-[var(--color-text-muted)]">v{skill.version}</span>
                    {saved && <span className="text-xs text-[var(--color-success)]">Saved ✓</span>}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleValidate}
                        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                    >
                        Validate
                    </button>
                    <button
                        onClick={() => void handleSave('patch')}
                        disabled={saving}
                        className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:opacity-90"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    <select
                        onChange={(e) => { if (e.target.value) void handleSave(e.target.value as 'minor' | 'major') }}
                        value=""
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-secondary)]"
                    >
                        <option value="">Bump...</option>
                        <option value="minor">Minor</option>
                        <option value="major">Major</option>
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--color-border)] px-6">
                {TAB_OPTIONS.map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            tab === t
                                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                        }`}
                    >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Form content */}
                <div className="flex-1 p-6 overflow-auto">
                    {tab === 'basic' && (
                        <div className="max-w-xl space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Skill Type *</label>
                                <div className="flex gap-2">
                                    {SKILL_TYPES.map(type => (
                                        <button
                                            key={type}
                                            onClick={() => update({ type })}
                                            className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                                                skill.type === type
                                                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/50'
                                            }`}
                                        >
                                            {type.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name *</label>
                                <input
                                    type="text" value={skill.name}
                                    onChange={(e) => update({ name: e.target.value })}
                                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description *</label>
                                <textarea
                                    value={skill.description}
                                    onChange={(e) => update({ description: e.target.value })}
                                    rows={3}
                                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Category</label>
                                    <input
                                        type="text" value={skill.category ?? ''}
                                        onChange={(e) => update({ category: e.target.value || '' })}
                                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Author</label>
                                    <input
                                        type="text" value={skill.author ?? ''}
                                        onChange={(e) => update({ author: e.target.value || undefined })}
                                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                    />
                                </div>
                            </div>
                            {skill.type === 'tool_wrapper' && (
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Tool Name</label>
                                    <input
                                        type="text" value={skill.toolName ?? ''}
                                        onChange={(e) => update({ toolName: e.target.value || undefined })}
                                        placeholder="tool_identifier"
                                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] font-mono"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'capabilities' && (
                        <div className="max-w-xl space-y-3">
                            <p className="text-xs text-[var(--color-text-muted)]">Capabilities this skill requires from its host agent.</p>
                            <div className="grid grid-cols-2 gap-2">
                                {CAPABILITIES.map(cap => (
                                    <button
                                        key={cap}
                                        onClick={() => toggleCapability(cap)}
                                        className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                                            skill.requiredCapabilities.includes(cap)
                                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/50'
                                        }`}
                                    >
                                        {cap.replace(/_/g, ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === 'schema' && (
                        <div className="max-w-xl space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Input Schema (JSON)</label>
                                <textarea
                                    value={JSON.stringify(skill.inputSchema, null, 2)}
                                    onChange={(e) => handleSchemaChange('inputSchema', e.target.value)}
                                    rows={8}
                                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-primary)] resize-none font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Output Schema (JSON)</label>
                                <textarea
                                    value={JSON.stringify(skill.outputSchema, null, 2)}
                                    onChange={(e) => handleSchemaChange('outputSchema', e.target.value)}
                                    rows={8}
                                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-primary)] resize-none font-mono"
                                />
                            </div>
                        </div>
                    )}

                    {tab === 'prompt' && (
                        <div className="max-w-xl space-y-4">
                            {skill.type !== 'llm_prompt' ? (
                                <div className="rounded-lg border border-[var(--color-border)] p-6 text-center">
                                    <p className="text-sm text-[var(--color-text-muted)]">
                                        Prompt editing is only available for <strong>llm_prompt</strong> type skills.
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                        Current type: {skill.type}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Model</label>
                                        <input
                                            type="text" value={skill.model ?? ''}
                                            onChange={(e) => update({ model: e.target.value || undefined })}
                                            placeholder="gpt-4"
                                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Temperature</label>
                                        <input
                                            type="number" value={skill.temperature ?? 0.7}
                                            onChange={(e) => update({ temperature: Number(e.target.value) })}
                                            step={0.1} min={0} max={2}
                                            className="w-32 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">System Prompt</label>
                                        <textarea
                                            value={skill.systemPrompt ?? ''}
                                            onChange={(e) => update({ systemPrompt: e.target.value || undefined })}
                                            rows={6}
                                            placeholder="You are a helpful assistant that..."
                                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">User Prompt Template</label>
                                        <textarea
                                            value={skill.promptTemplate ?? ''}
                                            onChange={(e) => update({ promptTemplate: e.target.value || undefined })}
                                            rows={6}
                                            placeholder="Given {{input}}, generate..."
                                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none font-mono"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Validation sidebar */}
                {validation && (
                    <div className="w-72 shrink-0 border-l border-[var(--color-border)] overflow-auto p-4">
                        <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                            Validation
                            {errorCount > 0 && <span className="ml-1 text-[var(--color-danger)]">({errorCount} errors)</span>}
                            {warnCount > 0 && <span className="ml-1 text-[var(--color-warning)]">({warnCount} warnings)</span>}
                        </h3>
                        <div className="space-y-1">
                            {validation.issues.map((issue, i) => (
                                <div key={i} className={`rounded p-2 text-xs ${
                                    issue.severity === 'error' ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' :
                                    issue.severity === 'warning' ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' :
                                    'bg-[var(--color-info)]/10 text-[var(--color-info)]'
                                }`}>
                                    <span className="font-medium">{issue.field}:</span> {issue.message}
                                </div>
                            ))}
                            {validation.valid && validation.issues.length === 0 && (
                                <div className="rounded p-2 text-xs bg-[var(--color-success)]/10 text-[var(--color-success)]">
                                    All checks passed ✓
                                </div>
                            )}
                        </div>

                        {versionHistory.length > 0 && (
                            <div className="mt-4">
                                <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Version History</h3>
                                <div className="space-y-1">
                                    {versionHistory.map((v, i) => (
                                        <div key={i} className="rounded p-2 text-xs bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]">
                                            v{v.version} ({v.bump}) — {new Date(v.createdAt).toLocaleDateString()}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
