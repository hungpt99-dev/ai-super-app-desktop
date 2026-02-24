/**
 * Skill IPC Handler — manages skill definitions from renderer requests.
 *
 * Channels:
 * - skill:save      → validate + version + persist
 * - skill:load      → load skill definition + version history
 * - skill:delete    → delete skill + version history
 * - skill:list-local → list all local skills
 * - skill:validate  → validate skill definition
 */

import type {
    ISkillDefinitionDTO,
    IValidationResultDTO,
    ISkillSavePayload,
    ISkillSaveResult,
    ISkillLoadResult,
    ILocalSkillListItem,
} from '@agenthub/contracts'
import type { IFileStoragePort } from '@agenthub/contracts'
import { logger } from '@agenthub/shared'
import { TauriFileStorageAdapter } from '../../bridges/tauri-file-storage.js'
import { SemanticVersioningAdapter } from '@agenthub/infrastructure'

const log = logger.child('SkillIPC')

const SKILLS_DIR = 'skills'

export class SkillIPCHandler {
    private storage: IFileStoragePort
    private versioning: SemanticVersioningAdapter

    constructor(
        storage?: IFileStoragePort,
        versioning?: SemanticVersioningAdapter,
    ) {
        this.storage = storage ?? new TauriFileStorageAdapter()
        this.versioning = versioning ?? new SemanticVersioningAdapter(this.storage)
    }

    setStorage(storage: IFileStoragePort): void {
        this.storage = storage
    }

    setVersioning(versioning: SemanticVersioningAdapter): void {
        this.versioning = versioning
    }

    async save(payload: ISkillSavePayload): Promise<ISkillSaveResult> {
        const { skill, bump } = payload

        const validation = validateSkillDefinition(skill)
        if (!validation.valid) {
            return {
                skillId: skill.id,
                version: skill.version,
                validation,
            }
        }

        const versionBump = bump ?? 'patch'
        const newVersion = await this.versioning.bump(skill.id, 'skill', versionBump, {
            name: skill.name,
            requiredCapabilities: skill.requiredCapabilities,
        })

        const versionedSkill: ISkillDefinitionDTO = {
            ...skill,
            version: newVersion,
            updatedAt: new Date().toISOString(),
        }

        await this.storage.copyToVersionDir(SKILLS_DIR, `${skill.id}.json`, newVersion)
        await this.storage.writeJson(SKILLS_DIR, `${skill.id}.json`, versionedSkill)

        log.info('Skill saved', { skillId: skill.id, version: newVersion })

        return {
            skillId: skill.id,
            version: newVersion,
            validation,
        }
    }

    async load(skillId: string): Promise<ISkillLoadResult | null> {
        const skill = await this.storage.readJson<ISkillDefinitionDTO>(SKILLS_DIR, `${skillId}.json`)
        if (!skill) return null

        const history = await this.versioning.getHistory(skillId)
        const versionHistory = history?.versions.map(v => ({
            entityId: v.entityId,
            entityType: v.entityType,
            version: v.version,
            previousVersion: v.previousVersion,
            bump: v.bump,
            createdAt: v.createdAt,
        })) ?? []

        return { skill, versionHistory }
    }

    async delete(skillId: string): Promise<void> {
        await this.storage.deleteFile(SKILLS_DIR, `${skillId}.json`)
        await this.versioning.deleteHistory(skillId)
        log.info('Skill deleted', { skillId })
    }

    async listLocal(): Promise<readonly ILocalSkillListItem[]> {
        const skills = await this.storage.readAllJson<ISkillDefinitionDTO>(SKILLS_DIR)
        return skills.map(s => ({
            id: s.id,
            name: s.name,
            version: s.version,
            description: s.description,
            type: s.type ?? 'llm_prompt',
            category: s.category,
            author: s.author,
            icon: s.icon,
            updatedAt: s.updatedAt,
        }))
    }

    async validate(skill: ISkillDefinitionDTO): Promise<IValidationResultDTO> {
        return validateSkillDefinition(skill)
    }
}

function validateSkillDefinition(skill: ISkillDefinitionDTO): IValidationResultDTO {
    const issues: Array<{ field: string; message: string; severity: 'error' | 'warning' | 'info'; code: string }> = []

    if (!skill.id || skill.id.trim() === '') {
        issues.push({ field: 'id', message: 'Skill ID is required', severity: 'error', code: 'REQUIRED_FIELD' })
    }
    if (!skill.name || skill.name.trim() === '') {
        issues.push({ field: 'name', message: 'Skill name is required', severity: 'error', code: 'REQUIRED_FIELD' })
    }
    if (!skill.version || !/^\d+\.\d+\.\d+/.test(skill.version)) {
        issues.push({ field: 'version', message: 'Version must be semver format', severity: 'error', code: 'INVALID_VERSION' })
    }
    if (!skill.description || skill.description.trim() === '') {
        issues.push({ field: 'description', message: 'Description is required', severity: 'error', code: 'REQUIRED_FIELD' })
    }
    if (skill.requiredCapabilities.length === 0) {
        issues.push({ field: 'requiredCapabilities', message: 'At least one required capability should be declared', severity: 'warning', code: 'EMPTY_CAPABILITIES' })
    }

    for (const tool of skill.tools) {
        if (!tool.name || tool.name.trim() === '') {
            issues.push({ field: `tools.${tool.name}`, message: 'Tool name is required', severity: 'error', code: 'REQUIRED_FIELD' })
        }
        if (!tool.description || tool.description.trim() === '') {
            issues.push({ field: `tools.${tool.name}.description`, message: 'Tool description is required', severity: 'warning', code: 'MISSING_DESCRIPTION' })
        }
    }

    return {
        valid: issues.filter(i => i.severity === 'error').length === 0,
        issues,
        checkedAt: new Date().toISOString(),
    }
}

export const skillIPC = new SkillIPCHandler()
