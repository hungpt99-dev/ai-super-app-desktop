/**
 * MarketplaceClient — SDK abstraction for browsing and installing marketplace items.
 *
 * This client operates on definitions only — no runtime logic.
 * The actual data source is injected via the fetcher functions.
 */

import type {
    IAgentDefinitionDTO,
    ISkillDefinitionDTO,
    IAgentMarketplaceListingDTO,
    ISkillMarketplaceListingDTO,
    IInstallResultDTO,
    IValidationResultDTO,
} from '@agenthub/contracts'
import { validateAgentDefinition, validateSkillDefinition } from './definition-validator.js'
import { enforceCapabilities, BUILTIN_CAPABILITIES } from './capability-enforcer.js'

// ─── Storage Abstraction ────────────────────────────────────────────────────

export interface IDefinitionStorage {
    getAgent(id: string): IAgentDefinitionDTO | null
    saveAgent(agent: IAgentDefinitionDTO): void
    deleteAgent(id: string): void
    listAgents(): IAgentDefinitionDTO[]

    getSkill(id: string): ISkillDefinitionDTO | null
    saveSkill(skill: ISkillDefinitionDTO): void
    deleteSkill(id: string): void
    listSkills(): ISkillDefinitionDTO[]
}

// ─── Marketplace Data Source ────────────────────────────────────────────────

export interface IMarketplaceDataSource {
    fetchAgents(): Promise<IAgentMarketplaceListingDTO[]>
    fetchSkills(): Promise<ISkillMarketplaceListingDTO[]>
    fetchAgentDefinition(id: string): Promise<IAgentDefinitionDTO | null>
    fetchSkillDefinition(id: string): Promise<ISkillDefinitionDTO | null>
}

// ─── Marketplace Client ─────────────────────────────────────────────────────

export class MarketplaceClient {
    constructor(
        private readonly dataSource: IMarketplaceDataSource,
        private readonly storage: IDefinitionStorage,
    ) {}

    // ── Browse ───────────────────────────────────────────────────────────

    async browseAgents(): Promise<IAgentMarketplaceListingDTO[]> {
        return this.dataSource.fetchAgents()
    }

    async browseSkills(): Promise<ISkillMarketplaceListingDTO[]> {
        return this.dataSource.fetchSkills()
    }

    async getAgentDetail(id: string): Promise<IAgentDefinitionDTO | null> {
        return this.dataSource.fetchAgentDefinition(id)
    }

    async getSkillDetail(id: string): Promise<ISkillDefinitionDTO | null> {
        return this.dataSource.fetchSkillDefinition(id)
    }

    // ── Validate before install ──────────────────────────────────────────

    validateAgentBeforeInstall(agent: IAgentDefinitionDTO): IValidationResultDTO {
        const validation = validateAgentDefinition(agent, BUILTIN_CAPABILITIES)
        if (!validation.valid) return validation

        const enforcement = enforceCapabilities(agent, BUILTIN_CAPABILITIES)
        if (!enforcement.allowed) {
            return {
                valid: false,
                issues: [...validation.issues, ...enforcement.issues],
                checkedAt: new Date().toISOString(),
            }
        }

        return validation
    }

    validateSkillBeforeInstall(skill: ISkillDefinitionDTO): IValidationResultDTO {
        return validateSkillDefinition(skill, BUILTIN_CAPABILITIES)
    }

    // ── Install ──────────────────────────────────────────────────────────

    async installAgent(id: string): Promise<IInstallResultDTO> {
        const agent = await this.dataSource.fetchAgentDefinition(id)
        if (!agent) {
            return {
                status: 'failed',
                name: id,
                version: '',
                message: `Agent "${id}" not found in marketplace.`,
            }
        }

        // Check if already installed
        const existing = this.storage.getAgent(id)
        if (existing) {
            if (existing.version === agent.version) {
                return {
                    status: 'already_installed',
                    agentId: id,
                    name: agent.name,
                    version: agent.version,
                    message: `Agent "${agent.name}" v${agent.version} is already installed.`,
                }
            }
            // Version conflict
            return {
                status: 'version_conflict',
                agentId: id,
                name: agent.name,
                version: agent.version,
                previousVersion: existing.version,
                message: `Agent "${agent.name}" v${existing.version} is already installed. New version: v${agent.version}.`,
            }
        }

        // Validate
        const validation = this.validateAgentBeforeInstall(agent)
        if (!validation.valid) {
            return {
                status: 'failed',
                agentId: id,
                name: agent.name,
                version: agent.version,
                message: 'Validation failed before install.',
                validationResult: validation,
            }
        }

        // Store
        this.storage.saveAgent(agent)
        return {
            status: 'success',
            agentId: id,
            name: agent.name,
            version: agent.version,
            message: `Agent "${agent.name}" v${agent.version} installed successfully.`,
            installedAt: new Date().toISOString(),
            validationResult: validation,
        }
    }

    async installSkill(id: string): Promise<IInstallResultDTO> {
        const skill = await this.dataSource.fetchSkillDefinition(id)
        if (!skill) {
            return {
                status: 'failed',
                name: id,
                version: '',
                message: `Skill "${id}" not found in marketplace.`,
            }
        }

        const existing = this.storage.getSkill(id)
        if (existing) {
            if (existing.version === skill.version) {
                return {
                    status: 'already_installed',
                    skillId: id,
                    name: skill.name,
                    version: skill.version,
                    message: `Skill "${skill.name}" v${skill.version} is already installed.`,
                }
            }
            return {
                status: 'version_conflict',
                skillId: id,
                name: skill.name,
                version: skill.version,
                previousVersion: existing.version,
                message: `Skill "${skill.name}" v${existing.version} is already installed. New version: v${skill.version}.`,
            }
        }

        const validation = this.validateSkillBeforeInstall(skill)
        if (!validation.valid) {
            return {
                status: 'failed',
                skillId: id,
                name: skill.name,
                version: skill.version,
                message: 'Validation failed before install.',
                validationResult: validation,
            }
        }

        this.storage.saveSkill(skill)
        return {
            status: 'success',
            skillId: id,
            name: skill.name,
            version: skill.version,
            message: `Skill "${skill.name}" v${skill.version} installed successfully.`,
            installedAt: new Date().toISOString(),
            validationResult: validation,
        }
    }

    // Overwrite install (for version conflicts)
    async forceInstallAgent(id: string): Promise<IInstallResultDTO> {
        const agent = await this.dataSource.fetchAgentDefinition(id)
        if (!agent) {
            return {
                status: 'failed',
                name: id,
                version: '',
                message: `Agent "${id}" not found in marketplace.`,
            }
        }

        const validation = this.validateAgentBeforeInstall(agent)
        if (!validation.valid) {
            return {
                status: 'failed',
                agentId: id,
                name: agent.name,
                version: agent.version,
                message: 'Validation failed before install.',
                validationResult: validation,
            }
        }

        const existing = this.storage.getAgent(id)
        this.storage.saveAgent(agent)
        return {
            status: 'success',
            agentId: id,
            name: agent.name,
            version: agent.version,
            previousVersion: existing?.version,
            message: `Agent "${agent.name}" v${agent.version} installed (overwrite).`,
            installedAt: new Date().toISOString(),
            validationResult: validation,
        }
    }

    async forceInstallSkill(id: string): Promise<IInstallResultDTO> {
        const skill = await this.dataSource.fetchSkillDefinition(id)
        if (!skill) {
            return {
                status: 'failed',
                name: id,
                version: '',
                message: `Skill "${id}" not found in marketplace.`,
            }
        }

        const validation = this.validateSkillBeforeInstall(skill)
        if (!validation.valid) {
            return {
                status: 'failed',
                skillId: id,
                name: skill.name,
                version: skill.version,
                message: 'Validation failed before install.',
                validationResult: validation,
            }
        }

        const existing = this.storage.getSkill(id)
        this.storage.saveSkill(skill)
        return {
            status: 'success',
            skillId: id,
            name: skill.name,
            version: skill.version,
            previousVersion: existing?.version,
            message: `Skill "${skill.name}" v${skill.version} installed (overwrite).`,
            installedAt: new Date().toISOString(),
            validationResult: validation,
        }
    }

    // ── Local installed items ────────────────────────────────────────────

    getInstalledAgents(): IAgentDefinitionDTO[] {
        return this.storage.listAgents()
    }

    getInstalledSkills(): ISkillDefinitionDTO[] {
        return this.storage.listSkills()
    }

    uninstallAgent(id: string): void {
        this.storage.deleteAgent(id)
    }

    uninstallSkill(id: string): void {
        this.storage.deleteSkill(id)
    }
}
