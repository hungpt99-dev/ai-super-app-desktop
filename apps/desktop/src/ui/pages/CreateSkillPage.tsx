/**
 * CreateSkillPage — form for creating a custom skill definition.
 */

import { SkillForm } from '../components/definition/SkillForm'
import { ImportExportPanel } from '../components/definition/ImportExportPanel'
import { useDefinitionStore } from '../store/definition-store'

export function CreateSkillPage() {
    const { draftSkill, clearDraftSkill } = useDefinitionStore()

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                <div>
                    <h1 className="text-lg font-bold text-[var(--text-primary)]">Create Custom Skill</h1>
                    <p className="text-xs text-[var(--text-secondary)]">
                        Define required capabilities, tools, and validate before saving.
                    </p>
                </div>
                {draftSkill && (
                    <button
                        type="button"
                        onClick={clearDraftSkill}
                        className="px-3 py-1.5 text-xs border border-[var(--border)] text-[var(--text-secondary)] rounded-lg hover:text-red-400 hover:border-red-800"
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 py-6 space-y-8">
                    <SkillForm />

                    {/* Import/Export */}
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                        <ImportExportPanel mode="skill" />
                    </div>
                </div>
            </div>
        </div>
    )
}
