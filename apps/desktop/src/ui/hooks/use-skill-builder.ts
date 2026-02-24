/**
 * useSkillBuilder.ts — Hook for skill building logic.
 * 
 * All bridge calls and business logic go here (RULE 3).
 * No bridge calls allowed in components or pages.
 */

import { useState, useEffect, useCallback } from 'react'
import type {
    ISkillDefinitionDTO,
    IValidationResultDTO,
    IVersionRecordDTO,
} from '@agenthub/contracts'
import { getDesktopExtendedBridge } from '../../bridges/desktop-bridge'

export interface IUseSkillBuilderOptions {
    skillId?: string
}

export interface IUseSkillBuilderReturn {
    // State
    skill: ISkillDefinitionDTO
    validation: IValidationResultDTO | null
    versionHistory: readonly IVersionRecordDTO[]
    saving: boolean
    saved: boolean
    tab: SkillTab
    
    // Actions
    update: (partial: Partial<ISkillDefinitionDTO>) => void
    handleValidate: () => Promise<IValidationResultDTO>
    handleSave: (bump?: 'patch' | 'minor' | 'major') => Promise<boolean>
    toggleCapability: (cap: string) => void
    setTab: (tab: SkillTab) => void
    
    // Computed
    errorCount: number
    warnCount: number
    isEditMode: boolean
}

export type SkillTab = 'basic' | 'capabilities' | 'schema' | 'prompt'

const SKILL_TYPES = ['llm_prompt', 'tool_wrapper', 'graph_fragment'] as const
const CAPABILITIES = [
    'tool_use', 'network_access', 'memory_read', 'memory_write',
    'filesystem_read', 'filesystem_write', 'code_execution',
] as const

// Re-export constants for use in components
export { SKILL_TYPES, CAPABILITIES }

function createDefaultSkill(): ISkillDefinitionDTO {
    return {
        id: crypto.randomUUID(),
        name: '',
        version: '1.0.0',
        description: '',
        type: 'llm_prompt',
        requiredCapabilities: [],
        permissions: [],
        tools: [],
        category: '',
        inputSchema: {},
        outputSchema: {},
        createdAt: new Date().toISOString(),
    }
}

export function useSkillBuilder({ skillId }: IUseSkillBuilderOptions): IUseSkillBuilderReturn {
    const bridge = getDesktopExtendedBridge()
    const isEditMode = !!skillId
    
    const [skill, setSkill] = useState<ISkillDefinitionDTO>(createDefaultSkill())
    const [validation, setValidation] = useState<IValidationResultDTO | null>(null)
    const [versionHistory, setVersionHistory] = useState<readonly IVersionRecordDTO[]>([])
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [tab, setTab] = useState<SkillTab>('basic')

    // Load skill if in edit mode
    useEffect(() => {
        if (skillId) {
            void bridge.skillBuilder.load(skillId).then(result => {
                if (result) {
                    setSkill(result.skill)
                    setVersionHistory(result.versionHistory)
                }
            })
        }
    }, [skillId, bridge])

    const update = useCallback((partial: Partial<ISkillDefinitionDTO>) => {
        setSkill(prev => ({ ...prev, ...partial, updatedAt: new Date().toISOString() } as ISkillDefinitionDTO))
        setSaved(false)
    }, [])

    const handleValidate = useCallback(async () => {
        const result = await bridge.skillBuilder.validate(skill)
        setValidation(result)
        return result
    }, [skill, bridge])

    const handleSave = useCallback(async (bump?: 'patch' | 'minor' | 'major'): Promise<boolean> => {
        setSaving(true)
        try {
            const result = await bridge.skillBuilder.save({ skill, bump })
            setValidation(result.validation)
            if (result.validation.valid) {
                setSkill(prev => ({ ...prev, version: result.version }))
                setSaved(true)
                return true
            }
            return false
        } finally {
            setSaving(false)
        }
    }, [skill, bridge])

    const toggleCapability = useCallback((cap: string) => {
        const next = skill.requiredCapabilities.includes(cap)
            ? skill.requiredCapabilities.filter((c: string) => c !== cap)
            : [...skill.requiredCapabilities, cap]
        update({ requiredCapabilities: next })
    }, [skill.requiredCapabilities, update])

    const errorCount = validation?.issues.filter(i => i.severity === 'error').length ?? 0
    const warnCount = validation?.issues.filter(i => i.severity === 'warning').length ?? 0

    return {
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
    }
}
