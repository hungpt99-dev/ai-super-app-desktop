/**
 * AgentEditorPage — Unified agent creation/editing page.
 * 
 * Combines CreateAgentPage and AgentBuilderPage into a single page.
 * Uses mode: 'create' | 'edit' based on presence of agentId.
 * 
 * Architecture:
 * - Pages only compose components (RULE 1)
 * - All logic in hooks (RULE 3)
 * - No bridge calls in page (RULE 5)
 */

import React from 'react'
import { useAgentBuilder, CATEGORIES, CAPABILITIES, type AgentTab } from '../hooks/use-agent-builder'

interface IProps {
    agentId?: string
    onBack: () => void
}

const TAB_OPTIONS: AgentTab[] = ['basic', 'capabilities', 'memory', 'tools', 'skills', 'graph']

export function AgentEditorPage({ agentId, onBack }: IProps): React.JSX.Element {
    const {
        agent,
        validation,
        versionHistory,
        saving,
        saved,
        tab,
        availableSkills,
        update,
        handleValidate,
        handleSave,
        toggleCapability,
        toggleMemoryScope,
        addTool,
        removeTool,
        setTab,
        attachSkill,
        detachSkill,
        errorCount,
        warnCount,
        isEditMode,
    } = useAgentBuilder({ agentId })

    const updateTool = (index: number, field: 'name' | 'description', value: string) => {
        const tools = [...agent.tools]
        tools[index] = { ...tools[index], [field]: value }
        update({ tools })
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7-7 7 7 7" /></svg>
                    </button>
                    <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {isEditMode ? 'Edit Agent' : 'Agent Builder'}
                    </h1>
                    <span className="text-xs text-[var(--color-text-muted)]">v{agent.version}</span>
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
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name *</label>
                                <input
                                    type="text" value={agent.name}
                                    onChange={(e) => update({ name: e.target.value })}
                                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description *</label>
                                <textarea
                                    value={agent.description}
                                    onChange={(e) => update({ description: e.target.value })}
                                    rows={3}
                                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Category</label>
                                    <select
                                        value={agent.category ?? ''}
                                        onChange={(e) => update({ category: e.target.value || undefined })}
                                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                    >
                                        <option value="">Select...</option>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Author</label>
                                    <input
                                        type="text" value={agent.author ?? ''}
                                        onChange={(e) => update({ author: e.target.value || undefined })}
                                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Model</label>
                                    <input
                                        type="text" value={agent.model ?? ''}
                                        onChange={(e) => update({ model: e.target.value || undefined })}
                                        placeholder="gpt-4"
                                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Token Budget</label>
                                    <input
                                        type="number" value={agent.maxTokenBudget ?? ''}
                                        onChange={(e) => update({ maxTokenBudget: e.target.value ? Number(e.target.value) : undefined })}
                                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">System Prompt</label>
                                <textarea
                                    value={agent.systemPrompt ?? ''}
                                    onChange={(e) => update({ systemPrompt: e.target.value || undefined })}
                                    rows={4}
                                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none font-mono"
                                />
                            </div>
                        </div>
                    )}

                    {tab === 'capabilities' && (
                        <div className="max-w-xl space-y-3">
                            <p className="text-xs text-[var(--color-text-muted)]">Select capabilities this agent declares.</p>
                            <div className="grid grid-cols-2 gap-2">
                                {CAPABILITIES.map(cap => (
                                    <button
                                        key={cap}
                                        onClick={() => toggleCapability(cap)}
                                        className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                                            agent.capabilities.includes(cap)
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

                    {tab === 'memory' && (
                        <div className="max-w-xl space-y-4">
                            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                                <input
                                    type="checkbox"
                                    checked={agent.memoryConfig.enabled}
                                    onChange={(e) => update({ memoryConfig: { ...agent.memoryConfig, enabled: e.target.checked } })}
                                    className="rounded"
                                />
                                Enable Memory
                            </label>
                            {agent.memoryConfig.enabled && (
                                <div className="pl-6 space-y-3">
                                    <p className="text-xs text-[var(--color-text-muted)]">Memory Scopes</p>
                                    {(['working', 'session', 'long-term'] as const).map(scope => (
                                        <label key={scope} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                                            <input
                                                type="checkbox"
                                                checked={agent.memoryConfig.scopes.includes(scope)}
                                                onChange={() => toggleMemoryScope(scope)}
                                                className="rounded"
                                            />
                                            {scope}
                                        </label>
                                    ))}
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Max entries per scope</label>
                                        <input
                                            type="number"
                                            value={agent.memoryConfig.maxEntriesPerScope ?? ''}
                                            onChange={(e) => update({
                                                memoryConfig: {
                                                    ...agent.memoryConfig,
                                                    maxEntriesPerScope: e.target.value ? Number(e.target.value) : undefined,
                                                },
                                            })}
                                            className="w-32 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'tools' && (
                        <div className="max-w-xl space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-[var(--color-text-muted)]">Agent tools (direct, not via skills)</p>
                                <button
                                    onClick={addTool}
                                    className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                                >
                                    + Add Tool
                                </button>
                            </div>
                            {agent.tools.map((tool, i) => (
                                <div key={i} className="rounded-lg border border-[var(--color-border)] p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <input
                                            type="text" value={tool.name}
                                            onChange={(e) => updateTool(i, 'name', e.target.value)}
                                            placeholder="tool_name"
                                            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-primary)] font-mono"
                                        />
                                        <button onClick={() => removeTool(i)} className="text-xs text-[var(--color-danger)] hover:opacity-80">Remove</button>
                                    </div>
                                    <textarea
                                        value={tool.description}
                                        onChange={(e) => updateTool(i, 'description', e.target.value)}
                                        placeholder="Tool description..."
                                        rows={2}
                                        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-primary)] resize-none"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'skills' && (
                        <div className="max-w-xl space-y-4">
                            <p className="text-xs text-[var(--color-text-muted)]">Attached skills ({agent.skills.length})</p>
                            {agent.skills.map((skill, i) => (
                                <div key={skill.id} className="rounded-lg border border-[var(--color-border)] p-3 flex items-center justify-between">
                                    <div>
                                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{skill.name}</span>
                                        <span className="ml-2 text-xs text-[var(--color-text-muted)]">v{skill.version}</span>
                                    </div>
                                    <button
                                        onClick={() => detachSkill(i)}
                                        className="text-xs text-[var(--color-danger)] hover:opacity-80"
                                    >
                                        Detach
                                    </button>
                                </div>
                            ))}
                            <div className="border-t border-[var(--color-border)] pt-3">
                                <p className="text-xs text-[var(--color-text-muted)] mb-2">Available Skills</p>
                                {availableSkills.length === 0 ? (
                                    <p className="text-xs text-[var(--color-text-muted)]">No local skills. Create one first.</p>
                                ) : (
                                    <div className="space-y-1">
                                        {availableSkills
                                            .filter(s => !agent.skills.some(as => as.id === s.id))
                                            .map(skill => (
                                                <button
                                                    key={skill.id}
                                                    onClick={() => void attachSkill(skill.id)}
                                                    className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] p-2 text-left hover:bg-[var(--color-surface-2)]"
                                                >
                                                    <span className="text-sm text-[var(--color-text-primary)]">{skill.name}</span>
                                                    <span className="text-xs text-[var(--color-accent)]">Attach</span>
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'graph' && (
                        <div className="flex items-center justify-center h-full">
                            <div className="space-y-2 text-center">
                                <div className="mx-auto h-12 w-12 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-text-muted)]">
                                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                    </svg>
                                </div>
                                <p className="text-sm text-[var(--color-text-muted)]">Visual graph editor coming soon</p>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    Define execution graphs with drag-and-drop nodes
                                </p>
                            </div>
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
