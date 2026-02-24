/**
 * AgentDetailPage — view details of an installed or marketplace agent definition.
 * Shows full definition, validation status, and management actions.
 */

import { useEffect, useState } from 'react'
import type { IAgentDefinitionDTO } from '@agenthub/contracts'
import { definition } from '@agenthub/sdk'
import { useDefinitionStore } from '../store/definition-store'
import { ValidationPanel } from '../components/definition/ValidationPanel'

interface AgentDetailPageProps {
    agentId: string
    onBack: () => void
}

export function AgentDetailPage({ agentId, onBack }: AgentDetailPageProps) {
    const { installedAgents, deleteLocalAgent, exportAgent, exportJson, clearExport } = useDefinitionStore()
    const [validation, setValidation] = useState<ReturnType<typeof definition.validateAgentDefinition> | null>(null)
    const [enforcement, setEnforcement] = useState<definition.ICapabilityEnforcementResult | null>(null)

    const agent = installedAgents.find((a) => a.id === agentId) ?? null

    useEffect(() => {
        if (agent) {
            setValidation(definition.validateAgentDefinition(agent, definition.BUILTIN_CAPABILITIES))
            setEnforcement(definition.enforceCapabilities(agent, definition.BUILTIN_CAPABILITIES))
        }
    }, [agent])

    if (!agent) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-sm text-[var(--text-secondary)]">Agent not found.</p>
                    <button type="button" onClick={onBack} className="mt-2 text-xs text-[var(--accent)]">Go Back</button>
                </div>
            </div>
        )
    }

    async function handleDownloadExport() {
        if (!exportJson) return
        try {
            // @ts-expect-error plugin-dialog may not be installed
            const { save } = await import('@tauri-apps/plugin-dialog')
            const { writeTextFile } = await import('@tauri-apps/plugin-fs')
            const path = await save({
                defaultPath: `${agent!.name.replace(/\s+/g, '-').toLowerCase()}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }],
            })
            if (path) await writeTextFile(path, exportJson)
        } catch {
            const blob = new Blob([exportJson], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${agent!.name.replace(/\s+/g, '-').toLowerCase()}.json`
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
                <button type="button" onClick={onBack} className="text-sm text-[var(--accent)] hover:underline">&larr; Back</button>
                <div className="flex-1" />
                <button type="button" onClick={() => exportAgent(agent)} className="px-3 py-1.5 text-xs border border-[var(--border)] text-[var(--text-primary)] rounded-lg hover:border-[var(--accent)]">Export</button>
                <button
                    type="button"
                    onClick={() => { deleteLocalAgent(agent.id); onBack() }}
                    className="px-3 py-1.5 text-xs border border-red-800 text-red-400 rounded-lg hover:bg-red-900/30"
                >
                    Delete
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-start gap-4">
                        <span className="text-4xl">{agent.icon ?? '🤖'}</span>
                        <div>
                            <h1 className="text-xl font-bold text-[var(--text-primary)]">{agent.name}</h1>
                            <p className="text-sm text-[var(--text-secondary)]">v{agent.version} | {agent.category ?? 'General'} | by {agent.author ?? 'Unknown'}</p>
                            <p className="text-sm text-[var(--text-primary)] mt-2">{agent.description}</p>
                        </div>
                    </div>

                    {/* Signature */}
                    {agent.signature && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/20 border border-green-800">
                            <span className="text-green-400 text-xs">Verified</span>
                            <span className="text-[10px] font-mono text-green-500 truncate">{agent.signature}</span>
                        </div>
                    )}

                    {/* Capabilities */}
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">Capabilities ({agent.capabilities.length})</h3>
                        <div className="flex flex-wrap gap-1">
                            {agent.capabilities.map((cap) => (
                                <span key={cap} className="text-xs px-2 py-1 rounded bg-blue-900/20 text-blue-400 font-mono">{cap}</span>
                            ))}
                        </div>
                    </div>

                    {/* Memory */}
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">Memory</h3>
                        <div className="text-sm text-[var(--text-primary)]">
                            {agent.memoryConfig.enabled ? (
                                <>
                                    <p>Scopes: {agent.memoryConfig.scopes.join(', ')}</p>
                                    {agent.memoryConfig.maxEntriesPerScope && <p>Max entries: {agent.memoryConfig.maxEntriesPerScope}</p>}
                                    <p>Persist: {agent.memoryConfig.persistAcrossSessions ? 'Yes' : 'No'}</p>
                                </>
                            ) : (
                                <p className="text-[var(--text-secondary)]">Disabled</p>
                            )}
                        </div>
                    </div>

                    {/* Tools */}
                    {agent.tools.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">Direct Tools ({agent.tools.length})</h3>
                            <div className="space-y-2">
                                {agent.tools.map((tool) => (
                                    <div key={tool.name} className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                                        <span className="font-mono text-xs text-[var(--text-primary)]">{tool.name}</span>
                                        <p className="text-xs text-[var(--text-secondary)]">{tool.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Skills */}
                    {agent.skills.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">Attached Skills ({agent.skills.length})</h3>
                            <div className="space-y-2">
                                {agent.skills.map((skill) => (
                                    <div key={skill.id} className="px-3 py-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                                        <div className="flex items-center gap-2">
                                            <span>{skill.icon ?? '🧩'}</span>
                                            <span className="text-sm font-medium text-[var(--text-primary)]">{skill.name}</span>
                                            <span className="text-xs text-[var(--text-secondary)]">v{skill.version}</span>
                                        </div>
                                        <p className="text-xs text-[var(--text-secondary)] mt-1">{skill.description}</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {skill.requiredCapabilities.map((cap) => (
                                                <span key={cap} className="text-[10px] px-1 py-0.5 rounded bg-purple-900/20 text-purple-400 font-mono">{cap}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Config */}
                    <div className="grid grid-cols-2 gap-4">
                        {agent.model && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)] mb-1">Model</h3>
                                <p className="text-sm text-[var(--text-primary)]">{agent.model}</p>
                            </div>
                        )}
                        {agent.maxTokenBudget && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)] mb-1">Token Budget</h3>
                                <p className="text-sm text-[var(--text-primary)]">{agent.maxTokenBudget.toLocaleString()}</p>
                            </div>
                        )}
                    </div>

                    {/* Validation */}
                    <ValidationPanel validation={validation} title="Definition Validation" />

                    {enforcement && !enforcement.allowed && (
                        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
                            <h4 className="text-sm font-semibold text-red-400 mb-2">Capability Issues</h4>
                            {enforcement.issues.map((iss, idx) => (
                                <p key={idx} className="text-xs text-red-300">{iss.message}</p>
                            ))}
                        </div>
                    )}

                    {/* Export JSON */}
                    {exportJson && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Exported JSON</h3>
                                <button type="button" onClick={handleDownloadExport} className="text-xs text-[var(--accent)]">Download</button>
                                <button type="button" onClick={clearExport} className="text-xs text-[var(--text-secondary)]">Clear</button>
                            </div>
                            <pre className="px-4 py-3 text-xs text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border)] rounded-lg overflow-auto max-h-64">
                                {exportJson}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
