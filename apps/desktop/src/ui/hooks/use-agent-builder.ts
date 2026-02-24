/**
 * useAgentBuilder.ts — Hook for agent building logic.
 * 
 * All bridge calls and business logic go here (RULE 3).
 * No bridge calls allowed in components or pages.
 */

import { useState, useEffect, useCallback } from 'react'
import type {
    IAgentDefinitionDTO,
    IValidationResultDTO,
    ILocalSkillListItem,
    IVersionRecordDTO,
} from '@agenthub/contracts'
import { getDesktopExtendedBridge } from '../../bridges/desktop-bridge'

export interface IUseAgentBuilderOptions {
    agentId?: string
}

export interface IUseAgentBuilderReturn {
    // State
    agent: IAgentDefinitionDTO
    validation: IValidationResultDTO | null
    versionHistory: readonly IVersionRecordDTO[]
    saving: boolean
    saved: boolean
    tab: AgentTab
    availableSkills: readonly ILocalSkillListItem[]
    
    // Actions
    update: (partial: Partial<IAgentDefinitionDTO>) => void
    handleValidate: () => Promise<IValidationResultDTO>
    handleSave: (bump?: 'patch' | 'minor' | 'major') => Promise<boolean>
    toggleCapability: (cap: string) => void
    toggleMemoryScope: (scope: 'working' | 'session' | 'long-term') => void
    addTool: () => void
    removeTool: (index: number) => void
    setTab: (tab: AgentTab) => void
    attachSkill: (skillId: string) => Promise<void>
    detachSkill: (index: number) => void
    
    // Computed
    errorCount: number
    warnCount: number
    isEditMode: boolean
}

export type AgentTab = 'basic' | 'capabilities' | 'memory' | 'tools' | 'skills' | 'graph'

const CATEGORIES = ['productivity', 'developer', 'creative', 'finance', 'education', 'utilities'] as const
const CAPABILITIES = [
    'tool_use', 'network_access', 'memory_read', 'memory_write',
    'token_budget', 'agent_boundary', 'filesystem_read', 'filesystem_write',
    'computer_use', 'code_execution',
] as const

// Re-export constants for use in components
export { CATEGORIES, CAPABILITIES }

function createDefaultAgent(): IAgentDefinitionDTO {
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

export function useAgentBuilder({ agentId }: IUseAgentBuilderOptions): IUseAgentBuilderReturn {
    const bridge = getDesktopExtendedBridge()
    const isEditMode = !!agentId
    
    const [agent, setAgent] = useState<IAgentDefinitionDTO>(createDefaultAgent())
    const [validation, setValidation] = useState<IValidationResultDTO | null>(null)
    const [versionHistory, setVersionHistory] = useState<readonly IVersionRecordDTO[]>([])
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [tab, setTab] = useState<AgentTab>('basic')
    const [availableSkills, setAvailableSkills] = useState<readonly ILocalSkillListItem[]>([])

    // Load agent if in edit mode
    useEffect(() => {
        if (agentId) {
            void bridge.agentBuilder.load(agentId).then(result => {
                if (result) {
                    setAgent(result.agent)
                    setVersionHistory(result.versionHistory)
                }
            })
        }
    }, [agentId, bridge])

    // Load available skills
    useEffect(() => {
        void bridge.skillBuilder.listLocal().then(setAvailableSkills)
    }, [bridge])

    const update = useCallback((partial: Partial<IAgentDefinitionDTO>) => {
        setAgent(prev => ({ ...prev, ...partial, updatedAt: new Date().toISOString() } as IAgentDefinitionDTO))
        setSaved(false)
    }, [])

    const handleValidate = useCallback(async () => {
        const result = await bridge.agentBuilder.validate(agent)
        setValidation(result)
        return result
    }, [agent, bridge])

    const handleSave = useCallback(async (bump?: 'patch' | 'minor' | 'major'): Promise<boolean> => {
        setSaving(true)
        try {
            const result = await bridge.agentBuilder.save({ agent, bump })
            setValidation(result.validation)
            if (result.validation.valid) {
                setAgent(prev => ({ ...prev, version: result.version }))
                setSaved(true)
                return true
            }
            return false
        } finally {
            setSaving(false)
        }
    }, [agent, bridge])

    const toggleCapability = useCallback((cap: string) => {
        const next = agent.capabilities.includes(cap)
            ? agent.capabilities.filter(c => c !== cap)
            : [...agent.capabilities, cap]
        update({ capabilities: next, permissions: next })
    }, [agent.capabilities, update])

    const toggleMemoryScope = useCallback((scope: 'working' | 'session' | 'long-term') => {
        const scopes = agent.memoryConfig.scopes.includes(scope)
            ? agent.memoryConfig.scopes.filter(s => s !== scope)
            : [...agent.memoryConfig.scopes, scope]
        update({ memoryConfig: { ...agent.memoryConfig, scopes } })
    }, [agent.memoryConfig, update])

    const addTool = useCallback(() => {
        update({
            tools: [...agent.tools, {
                name: `tool_${String(agent.tools.length + 1)}`,
                description: '',
                inputSchema: {},
            }],
        })
    }, [agent.tools, update])

    const removeTool = useCallback((index: number) => {
        update({ tools: agent.tools.filter((_, i) => i !== index) })
    }, [agent.tools, update])

    const attachSkill = useCallback(async (skillId: string) => {
        const loaded = await bridge.skillBuilder.load(skillId)
        if (loaded) {
            update({ skills: [...agent.skills, loaded.skill] })
        }
    }, [agent.skills, bridge, update])

    const detachSkill = useCallback((index: number) => {
        update({ skills: agent.skills.filter((_, i) => i !== index) })
    }, [agent.skills, update])

    const errorCount = validation?.issues.filter(i => i.severity === 'error').length ?? 0
    const warnCount = validation?.issues.filter(i => i.severity === 'warning').length ?? 0

    return {
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
    }
}
