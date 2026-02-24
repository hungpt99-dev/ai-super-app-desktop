/**
 * AgentForm — multi-step form for creating/editing an agent definition.
 * All logic delegated to SDK via definition store.
 */

import { useState, useCallback } from 'react'
import type { IAgentDefinitionDTO, IToolConfigDTO, MemoryScope } from '@agenthub/contracts'
import { useDefinitionStore } from '../../store/definition-store'
import { CapabilitySelector } from './CapabilitySelector'
import { ValidationPanel } from './ValidationPanel'

const STEPS = ['Basic Info', 'Capabilities', 'Memory & Tools', 'Skills & Review'] as const
const CATEGORIES = ['productivity', 'developer', 'creative', 'finance', 'education', 'utilities'] as const

function defaultAgent(): IAgentDefinitionDTO {
    return {
        id: crypto.randomUUID(),
        name: '',
        version: '1.0.0',
        description: '',
        capabilities: [],
        permissions: [],
        memoryConfig: { enabled: false, scopes: [] },
        tools: [],
        skills: [],
        createdAt: new Date().toISOString(),
    }
}

export function AgentForm() {
    const {
        draftAgent,
        draftAgentValidation,
        draftAgentStep,
        enforcementResult,
        updateDraftAgent,
        setDraftAgentStep,
        saveAgentLocally,
    } = useDefinitionStore()

    const agent = draftAgent ?? defaultAgent()
    const step = draftAgentStep

    const update = useCallback(
        (partial: Partial<IAgentDefinitionDTO>) => {
            updateDraftAgent({ ...agent, ...partial, updatedAt: new Date().toISOString() } as IAgentDefinitionDTO)
        },
        [agent, updateDraftAgent],
    )

    // ── Tool editor state ────────────────────────────────────────────────
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
        update({ tools: [...agent.tools, tool] })
        setNewToolName('')
        setNewToolDesc('')
    }

    function removeTool(idx: number) {
        update({ tools: agent.tools.filter((_, i) => i !== idx) })
    }

    // ── Navigation ───────────────────────────────────────────────────────
    function next() { if (step < STEPS.length - 1) setDraftAgentStep(step + 1) }
    function prev() { if (step > 0) setDraftAgentStep(step - 1) }

    function handleSave() {
        saveAgentLocally(agent)
    }

    return (
        <div className="space-y-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
                {STEPS.map((label, idx) => (
                    <button
                        key={label}
                        type="button"
                        onClick={() => setDraftAgentStep(idx)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            idx === step
                                ? 'bg-[var(--color-accent)] text-white'
                                : idx < step
                                ? 'bg-[var(--color-success)]/30 text-[var(--color-success)]'
                                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                        }`}
                    >
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-black/20">
                            {idx < step ? '✓' : idx + 1}
                        </span>
                        {label}
                    </button>
                ))}
            </div>

            {/* Step 0: Basic Info */}
            {step === 0 && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name *</label>
                        <input
                            type="text"
                            value={agent.name}
                            onChange={(e) => update({ name: e.target.value })}
                            placeholder="My Custom Agent"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Version *</label>
                        <input
                            type="text"
                            value={agent.version}
                            onChange={(e) => update({ version: e.target.value })}
                            placeholder="1.0.0"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description *</label>
                        <textarea
                            value={agent.description}
                            onChange={(e) => update({ description: e.target.value })}
                            rows={3}
                            placeholder="What does this agent do?"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Category</label>
                            <select
                                value={agent.category ?? ''}
                                onChange={(e) => update({ category: e.target.value || undefined })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                            >
                                <option value="">Select...</option>
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Author</label>
                            <input
                                type="text"
                                value={agent.author ?? ''}
                                onChange={(e) => update({ author: e.target.value || undefined })}
                                placeholder="Your name"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Icon (emoji)</label>
                        <input
                            type="text"
                            value={agent.icon ?? ''}
                            onChange={(e) => update({ icon: e.target.value || undefined })}
                            placeholder="🤖"
                            maxLength={4}
                            className="w-20 px-3 py-2 text-sm text-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">System Prompt</label>
                        <textarea
                            value={agent.systemPrompt ?? ''}
                            onChange={(e) => update({ systemPrompt: e.target.value || undefined })}
                            rows={3}
                            placeholder="System prompt for the agent..."
                            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Model</label>
                            <input
                                type="text"
                                value={agent.model ?? ''}
                                onChange={(e) => update({ model: e.target.value || undefined })}
                                placeholder="gpt-4"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Max Token Budget</label>
                            <input
                                type="number"
                                value={agent.maxTokenBudget ?? ''}
                                onChange={(e) => update({ maxTokenBudget: e.target.value ? Number(e.target.value) : undefined })}
                                placeholder="100000"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Step 1: Capabilities */}
            {step === 1 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Agent Capabilities</h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                        Select capabilities this agent explicitly declares. Skills attached later must only require capabilities from this list.
                    </p>
                    <CapabilitySelector
                        selected={agent.capabilities}
                        onChange={(caps) => update({ capabilities: caps, permissions: caps })}
                    />
                </div>
            )}

            {/* Step 2: Memory & Tools */}
            {step === 2 && (
                <div className="space-y-6">
                    {/* Memory */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Memory Configuration</h3>
                        <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                            <input
                                type="checkbox"
                                checked={agent.memoryConfig.enabled}
                                onChange={(e) =>
                                    update({
                                        memoryConfig: {
                                            ...agent.memoryConfig,
                                            enabled: e.target.checked,
                                            scopes: e.target.checked ? ['working'] : [],
                                        },
                                    })
                                }
                                className="rounded"
                            />
                            Enable Memory
                        </label>

                        {agent.memoryConfig.enabled && (
                            <div className="space-y-3 pl-6">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Memory Scopes</label>
                                    <div className="flex gap-3">
                                        {(['working', 'session', 'long-term'] as MemoryScope[]).map((scope) => (
                                            <label key={scope} className="flex items-center gap-1 text-xs text-[var(--color-text-primary)]">
                                                <input
                                                    type="checkbox"
                                                    checked={agent.memoryConfig.scopes.includes(scope)}
                                                    onChange={(e) => {
                                                        const scopes = e.target.checked
                                                            ? [...agent.memoryConfig.scopes, scope]
                                                            : agent.memoryConfig.scopes.filter((s) => s !== scope)
                                                        update({ memoryConfig: { ...agent.memoryConfig, scopes } })
                                                    }}
                                                    className="rounded"
                                                />
                                                {scope}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Max Entries/Scope</label>
                                        <input
                                            type="number"
                                            value={agent.memoryConfig.maxEntriesPerScope ?? ''}
                                            onChange={(e) =>
                                                update({
                                                    memoryConfig: {
                                                        ...agent.memoryConfig,
                                                        maxEntriesPerScope: e.target.value ? Number(e.target.value) : undefined,
                                                    },
                                                })
                                            }
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
                                            <input
                                                type="checkbox"
                                                checked={agent.memoryConfig.persistAcrossSessions ?? false}
                                                onChange={(e) =>
                                                    update({
                                                        memoryConfig: {
                                                            ...agent.memoryConfig,
                                                            persistAcrossSessions: e.target.checked,
                                                        },
                                                    })
                                                }
                                                className="rounded"
                                            />
                                            Persist across sessions
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tools */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Tools</h3>
                        
                        {agent.tools.length > 0 && (
                            <div className="space-y-2">
                                {agent.tools.map((tool, idx) => (
                                    <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                                        <div className="flex-1 min-w-0">
                                            <span className="font-mono text-xs text-[var(--color-text-primary)]">{tool.name}</span>
                                            <p className="text-xs text-[var(--color-text-secondary)] truncate">{tool.description}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeTool(idx)}
                                            className="text-[var(--color-danger)] hover:opacity-80 text-xs px-2 py-1"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newToolName}
                                onChange={(e) => setNewToolName(e.target.value)}
                                placeholder="Tool name"
                                className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                            />
                            <input
                                type="text"
                                value={newToolDesc}
                                onChange={(e) => setNewToolDesc(e.target.value)}
                                placeholder="Tool description"
                                className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                            />
                            <button
                                type="button"
                                onClick={addTool}
                                className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Skills & Review */}
            {step === 3 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Attached Skills</h3>
                    {agent.skills.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-secondary)]">No skills attached yet. Use the Skill Attach panel below.</p>
                    ) : (
                        <div className="space-y-2">
                            {agent.skills.map((skill) => (
                                <div key={skill.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                                    <span className="text-lg">{skill.icon ?? '🧩'}</span>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm text-[var(--color-text-primary)]">{skill.name}</span>
                                        <span className="text-xs text-[var(--color-text-secondary)] ml-2">v{skill.version}</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {skill.requiredCapabilities.map((cap) => (
                                                <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-info)]/30 text-[var(--color-info)] font-mono">{cap}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => useDefinitionStore.getState().detachSkillFromAgent(skill.id)}
                                        className="text-[var(--color-danger)] hover:opacity-80 text-xs px-2 py-1"
                                    >
                                        Detach
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Validation */}
                    <ValidationPanel validation={draftAgentValidation} title="Agent Validation" />

                    {enforcementResult && !enforcementResult.allowed && (
                        <div className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger)]/20 p-4">
                            <h4 className="text-sm font-semibold text-[var(--color-danger)] mb-2">Capability Enforcement Failed</h4>
                            <div className="space-y-1">
                                {enforcementResult.issues.map((iss, idx) => (
                                    <p key={idx} className="text-xs text-[var(--color-danger)]">{iss.message}</p>
                                ))}
                            </div>
                            {enforcementResult.escalations.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-[var(--color-danger)]">
                                    <p className="text-xs font-semibold text-[var(--color-danger)] mb-1">Escalation Attempts:</p>
                                    {enforcementResult.escalations.map((esc, idx) => (
                                        <p key={idx} className="text-xs text-[var(--color-danger)]">{esc.reason}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* JSON Preview */}
                    <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                        <summary className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] cursor-pointer">JSON Preview</summary>
                        <pre className="px-4 py-3 text-xs text-[var(--color-text-secondary)] overflow-auto max-h-96 border-t border-[var(--color-border)]">
                            {JSON.stringify(agent, null, 2)}
                        </pre>
                    </details>
                </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                <button
                    type="button"
                    onClick={prev}
                    disabled={step === 0}
                    className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-30"
                >
                    Previous
                </button>
                <div className="flex gap-2">
                    {step < STEPS.length - 1 ? (
                        <button type="button" onClick={next} className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90">
                            Next
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!draftAgentValidation?.valid || (enforcementResult !== null && !enforcementResult.allowed)}
                            className="px-6 py-2 text-sm bg-[var(--color-success)] text-white rounded-lg hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Save Agent
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
