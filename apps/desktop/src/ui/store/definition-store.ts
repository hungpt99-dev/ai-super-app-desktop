/**
 * Definition Store — Zustand store for managing agent/skill definitions.
 *
 * All business logic goes through SDK. This store only manages UI state.
 */

import { create } from 'zustand'
import type {
    IAgentDefinitionDTO,
    ISkillDefinitionDTO,
    IAgentMarketplaceListingDTO,
    ISkillMarketplaceListingDTO,
    IValidationResultDTO,
    IInstallResultDTO,
    ICapabilityDefinitionDTO,
} from '@agenthub/contracts'
import { definition } from '@agenthub/sdk'
import { MockMarketplaceDataSource } from '../../mock-marketplace/mock-data-source'

// ─── In-memory definition storage for SDK ───────────────────────────────────

const localAgents = new Map<string, IAgentDefinitionDTO>()
const localSkills = new Map<string, ISkillDefinitionDTO>()

const inMemoryStorage: definition.IDefinitionStorage = {
    getAgent: (id) => localAgents.get(id) ?? null,
    saveAgent: (a) => { localAgents.set(a.id, a) },
    deleteAgent: (id) => { localAgents.delete(id) },
    listAgents: () => [...localAgents.values()],
    getSkill: (id) => localSkills.get(id) ?? null,
    saveSkill: (s) => { localSkills.set(s.id, s) },
    deleteSkill: (id) => { localSkills.delete(id) },
    listSkills: () => [...localSkills.values()],
}

const dataSource = new MockMarketplaceDataSource()
const marketplaceClient = new definition.MarketplaceClient(dataSource, inMemoryStorage)

// ─── Store State ────────────────────────────────────────────────────────────

interface IDefinitionState {
    // ── Agent creation ─────────────────────────────────────────────────
    draftAgent: IAgentDefinitionDTO | null
    draftAgentValidation: IValidationResultDTO | null
    draftAgentStep: number

    // ── Skill creation ─────────────────────────────────────────────────
    draftSkill: ISkillDefinitionDTO | null
    draftSkillValidation: IValidationResultDTO | null

    // ── Installed ──────────────────────────────────────────────────────
    installedAgents: IAgentDefinitionDTO[]
    installedSkills: ISkillDefinitionDTO[]

    // ── Marketplace ────────────────────────────────────────────────────
    agentListings: IAgentMarketplaceListingDTO[]
    skillListings: ISkillMarketplaceListingDTO[]
    marketplaceLoading: boolean
    selectedAgentDetail: IAgentDefinitionDTO | null
    selectedSkillDetail: ISkillDefinitionDTO | null

    // ── Install flow ───────────────────────────────────────────────────
    installResult: IInstallResultDTO | null
    showInstallConfirm: boolean
    pendingInstallType: 'agent' | 'skill' | null
    pendingInstallId: string | null

    // ── Import/Export ──────────────────────────────────────────────────
    importPreview: IAgentDefinitionDTO | ISkillDefinitionDTO | null
    importValidation: IValidationResultDTO | null
    exportJson: string | null

    // ── Capability enforcement ─────────────────────────────────────────
    enforcementResult: definition.ICapabilityEnforcementResult | null

    // ── Actions ────────────────────────────────────────────────────────
    // Agent creation
    setDraftAgentStep: (step: number) => void
    updateDraftAgent: (agent: IAgentDefinitionDTO) => void
    validateDraftAgent: () => void
    clearDraftAgent: () => void

    // Skill creation
    updateDraftSkill: (skill: ISkillDefinitionDTO) => void
    validateDraftSkill: () => void
    clearDraftSkill: () => void

    // Skill attachment
    attachSkillToAgent: (skill: ISkillDefinitionDTO) => definition.ICapabilityEnforcementResult | IValidationResultDTO
    detachSkillFromAgent: (skillId: string) => void

    // Marketplace
    fetchMarketplaceAgents: () => Promise<void>
    fetchMarketplaceSkills: () => Promise<void>
    selectAgentDetail: (id: string) => Promise<void>
    selectSkillDetail: (id: string) => Promise<void>
    clearDetail: () => void

    // Install flow
    requestInstall: (type: 'agent' | 'skill', id: string) => void
    confirmInstall: () => Promise<void>
    forceInstall: () => Promise<void>
    cancelInstall: () => void

    // Import/Export
    exportAgent: (agent: IAgentDefinitionDTO) => void
    exportSkill: (skill: ISkillDefinitionDTO) => void
    importAgentJson: (json: string) => void
    importSkillJson: (json: string) => void
    confirmImportAgent: () => void
    confirmImportSkill: () => void
    clearImport: () => void
    clearExport: () => void

    // Enforce capabilities
    enforceAgentCapabilities: (agent: IAgentDefinitionDTO) => void

    // Local management
    saveAgentLocally: (agent: IAgentDefinitionDTO) => void
    saveSkillLocally: (skill: ISkillDefinitionDTO) => void
    deleteLocalAgent: (id: string) => void
    deleteLocalSkill: (id: string) => void
    refreshInstalled: () => void
}

export const useDefinitionStore = create<IDefinitionState>((set, get) => ({
    // ── Initial state ────────────────────────────────────────────────────
    draftAgent: null,
    draftAgentValidation: null,
    draftAgentStep: 0,
    draftSkill: null,
    draftSkillValidation: null,
    installedAgents: [],
    installedSkills: [],
    agentListings: [],
    skillListings: [],
    marketplaceLoading: false,
    selectedAgentDetail: null,
    selectedSkillDetail: null,
    installResult: null,
    showInstallConfirm: false,
    pendingInstallType: null,
    pendingInstallId: null,
    importPreview: null,
    importValidation: null,
    exportJson: null,
    enforcementResult: null,

    // ── Agent creation ───────────────────────────────────────────────────

    setDraftAgentStep: (step) => set({ draftAgentStep: step }),

    updateDraftAgent: (agent) => {
        const validation = definition.validateAgentDefinition(agent, definition.BUILTIN_CAPABILITIES)
        const enforcement = definition.enforceCapabilities(agent, definition.BUILTIN_CAPABILITIES)
        set({
            draftAgent: agent,
            draftAgentValidation: validation,
            enforcementResult: enforcement,
        })
    },

    validateDraftAgent: () => {
        const { draftAgent } = get()
        if (!draftAgent) return
        const validation = definition.validateAgentDefinition(draftAgent, definition.BUILTIN_CAPABILITIES)
        const enforcement = definition.enforceCapabilities(draftAgent, definition.BUILTIN_CAPABILITIES)
        set({ draftAgentValidation: validation, enforcementResult: enforcement })
    },

    clearDraftAgent: () =>
        set({ draftAgent: null, draftAgentValidation: null, draftAgentStep: 0, enforcementResult: null }),

    // ── Skill creation ───────────────────────────────────────────────────

    updateDraftSkill: (skill) => {
        const validation = definition.validateSkillDefinition(skill, definition.BUILTIN_CAPABILITIES)
        set({ draftSkill: skill, draftSkillValidation: validation })
    },

    validateDraftSkill: () => {
        const { draftSkill } = get()
        if (!draftSkill) return
        const validation = definition.validateSkillDefinition(draftSkill, definition.BUILTIN_CAPABILITIES)
        set({ draftSkillValidation: validation })
    },

    clearDraftSkill: () => set({ draftSkill: null, draftSkillValidation: null }),

    // ── Skill attachment ─────────────────────────────────────────────────

    attachSkillToAgent: (skill) => {
        const { draftAgent } = get()
        if (!draftAgent) {
            return {
                valid: false,
                issues: [{ field: 'agent', message: 'No draft agent to attach skill to.', severity: 'error' as const, code: 'NO_DRAFT_AGENT' }],
                checkedAt: new Date().toISOString(),
            }
        }

        const attachValidation = definition.validateSkillAttachment(draftAgent, skill, definition.BUILTIN_CAPABILITIES)
        if (!attachValidation.valid) return attachValidation

        const updatedAgent: IAgentDefinitionDTO = {
            ...draftAgent,
            skills: [...draftAgent.skills, skill],
        }

        const enforcement = definition.enforceCapabilities(updatedAgent, definition.BUILTIN_CAPABILITIES)
        if (!enforcement.allowed) return enforcement

        const validation = definition.validateAgentDefinition(updatedAgent, definition.BUILTIN_CAPABILITIES)
        set({ draftAgent: updatedAgent, draftAgentValidation: validation, enforcementResult: enforcement })
        return enforcement
    },

    detachSkillFromAgent: (skillId) => {
        const { draftAgent } = get()
        if (!draftAgent) return
        const updatedAgent: IAgentDefinitionDTO = {
            ...draftAgent,
            skills: draftAgent.skills.filter((s) => s.id !== skillId),
        }
        const validation = definition.validateAgentDefinition(updatedAgent, definition.BUILTIN_CAPABILITIES)
        const enforcement = definition.enforceCapabilities(updatedAgent, definition.BUILTIN_CAPABILITIES)
        set({ draftAgent: updatedAgent, draftAgentValidation: validation, enforcementResult: enforcement })
    },

    // ── Marketplace ──────────────────────────────────────────────────────

    fetchMarketplaceAgents: async () => {
        set({ marketplaceLoading: true })
        try {
            const listings = await marketplaceClient.browseAgents()
            set({ agentListings: listings, marketplaceLoading: false })
        } catch {
            set({ marketplaceLoading: false })
        }
    },

    fetchMarketplaceSkills: async () => {
        set({ marketplaceLoading: true })
        try {
            const listings = await marketplaceClient.browseSkills()
            set({ skillListings: listings, marketplaceLoading: false })
        } catch {
            set({ marketplaceLoading: false })
        }
    },

    selectAgentDetail: async (id) => {
        const agent = await marketplaceClient.getAgentDetail(id)
        set({ selectedAgentDetail: agent })
    },

    selectSkillDetail: async (id) => {
        const skill = await marketplaceClient.getSkillDetail(id)
        set({ selectedSkillDetail: skill })
    },

    clearDetail: () => set({ selectedAgentDetail: null, selectedSkillDetail: null }),

    // ── Install flow ─────────────────────────────────────────────────────

    requestInstall: (type, id) =>
        set({ showInstallConfirm: true, pendingInstallType: type, pendingInstallId: id, installResult: null }),

    confirmInstall: async () => {
        const { pendingInstallType, pendingInstallId } = get()
        if (!pendingInstallType || !pendingInstallId) return

        let result: IInstallResultDTO
        if (pendingInstallType === 'agent') {
            result = await marketplaceClient.installAgent(pendingInstallId)
        } else {
            result = await marketplaceClient.installSkill(pendingInstallId)
        }

        set({ installResult: result, showInstallConfirm: false })
        get().refreshInstalled()
    },

    forceInstall: async () => {
        const { pendingInstallType, pendingInstallId } = get()
        if (!pendingInstallType || !pendingInstallId) return

        let result: IInstallResultDTO
        if (pendingInstallType === 'agent') {
            result = await marketplaceClient.forceInstallAgent(pendingInstallId)
        } else {
            result = await marketplaceClient.forceInstallSkill(pendingInstallId)
        }

        set({ installResult: result, showInstallConfirm: false })
        get().refreshInstalled()
    },

    cancelInstall: () =>
        set({ showInstallConfirm: false, pendingInstallType: null, pendingInstallId: null }),

    // ── Import/Export ────────────────────────────────────────────────────

    exportAgent: (agent) => {
        const json = definition.exportAgentToJSON(agent)
        set({ exportJson: json })
    },

    exportSkill: (skill) => {
        const json = definition.exportSkillToJSON(skill)
        set({ exportJson: json })
    },

    importAgentJson: (json) => {
        const result = definition.importAgentFromJSON(json)
        if (result.success && result.data) {
            set({ importPreview: result.data, importValidation: result.validation ?? null })
        } else {
            set({
                importPreview: null,
                importValidation: result.validation ?? {
                    valid: false,
                    issues: [{ field: 'json', message: result.error ?? 'Invalid JSON', severity: 'error', code: 'IMPORT_FAILED' }],
                    checkedAt: new Date().toISOString(),
                },
            })
        }
    },

    importSkillJson: (json) => {
        const result = definition.importSkillFromJSON(json)
        if (result.success && result.data) {
            set({ importPreview: result.data, importValidation: result.validation ?? null })
        } else {
            set({
                importPreview: null,
                importValidation: result.validation ?? {
                    valid: false,
                    issues: [{ field: 'json', message: result.error ?? 'Invalid JSON', severity: 'error', code: 'IMPORT_FAILED' }],
                    checkedAt: new Date().toISOString(),
                },
            })
        }
    },

    confirmImportAgent: () => {
        const { importPreview } = get()
        if (!importPreview) return
        inMemoryStorage.saveAgent(importPreview as IAgentDefinitionDTO)
        set({ importPreview: null, importValidation: null })
        get().refreshInstalled()
    },

    confirmImportSkill: () => {
        const { importPreview } = get()
        if (!importPreview) return
        inMemoryStorage.saveSkill(importPreview as ISkillDefinitionDTO)
        set({ importPreview: null, importValidation: null })
        get().refreshInstalled()
    },

    clearImport: () => set({ importPreview: null, importValidation: null }),

    clearExport: () => set({ exportJson: null }),

    // ── Capability enforcement ───────────────────────────────────────────

    enforceAgentCapabilities: (agent) => {
        const result = definition.enforceCapabilities(agent, definition.BUILTIN_CAPABILITIES)
        set({ enforcementResult: result })
    },

    // ── Local management ─────────────────────────────────────────────────

    saveAgentLocally: (agent) => {
        const validation = definition.validateAgentDefinition(agent, definition.BUILTIN_CAPABILITIES)
        if (!validation.valid) {
            set({ draftAgentValidation: validation })
            return
        }
        const enforcement = definition.enforceCapabilities(agent, definition.BUILTIN_CAPABILITIES)
        if (!enforcement.allowed) {
            set({ enforcementResult: enforcement })
            return
        }
        inMemoryStorage.saveAgent(agent)
        get().refreshInstalled()
        set({ draftAgent: null, draftAgentValidation: null, draftAgentStep: 0, enforcementResult: null })
    },

    saveSkillLocally: (skill) => {
        const validation = definition.validateSkillDefinition(skill, definition.BUILTIN_CAPABILITIES)
        if (!validation.valid) {
            set({ draftSkillValidation: validation })
            return
        }
        inMemoryStorage.saveSkill(skill)
        get().refreshInstalled()
        set({ draftSkill: null, draftSkillValidation: null })
    },

    deleteLocalAgent: (id) => {
        inMemoryStorage.deleteAgent(id)
        get().refreshInstalled()
    },

    deleteLocalSkill: (id) => {
        inMemoryStorage.deleteSkill(id)
        get().refreshInstalled()
    },

    refreshInstalled: () => {
        set({
            installedAgents: inMemoryStorage.listAgents(),
            installedSkills: inMemoryStorage.listSkills(),
        })
    },
}))
