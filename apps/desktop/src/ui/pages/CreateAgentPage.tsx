/**
 * CreateAgentPage — multi-step form for creating a custom agent definition.
 * Includes capability selection, skill attachment, and real-time validation.
 */

import { AgentForm } from '../components/definition/AgentForm'
import { SkillAttachPanel } from '../components/definition/SkillAttachPanel'
import { ImportExportPanel } from '../components/definition/ImportExportPanel'
import { useDefinitionStore } from '../store/definition-store'

export function CreateAgentPage() {
    const { draftAgent, draftAgentStep, clearDraftAgent } = useDefinitionStore()

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                <div>
                    <h1 className="text-lg font-bold text-[var(--text-primary)]">Create Custom Agent</h1>
                    <p className="text-xs text-[var(--text-secondary)]">
                        Define capabilities, attach skills, and validate before saving.
                    </p>
                </div>
                {draftAgent && (
                    <button
                        type="button"
                        onClick={clearDraftAgent}
                        className="px-3 py-1.5 text-xs border border-[var(--border)] text-[var(--text-secondary)] rounded-lg hover:text-red-400 hover:border-red-800"
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 py-6 space-y-8">
                    <AgentForm />

                    {/* Skill Attach Panel — visible on step 3 */}
                    {draftAgentStep === 3 && (
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                            <SkillAttachPanel />
                        </div>
                    )}

                    {/* Import/Export */}
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                        <ImportExportPanel mode="agent" />
                    </div>
                </div>
            </div>
        </div>
    )
}
