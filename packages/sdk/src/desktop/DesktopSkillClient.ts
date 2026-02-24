/**
 * DesktopSkillClient — SDK layer for skill builder/library.
 *
 * Wraps IPC calls to the main process.
 * Must not instantiate runtime.
 * Must not import execution or core.
 *
 * Renderer imports this via @agenthub/sdk.
 */

import type {
    ISkillDefinitionDTO,
    ISkillSavePayload,
    ISkillSaveResult,
    ISkillLoadResult,
    ILocalSkillListItem,
    IValidationResultDTO,
} from '@agenthub/contracts'

export interface IDesktopSkillClient {
    saveSkill(skill: ISkillDefinitionDTO, bump?: 'patch' | 'minor' | 'major'): Promise<ISkillSaveResult>
    loadSkill(skillId: string): Promise<ISkillLoadResult | null>
    deleteSkill(skillId: string): Promise<void>
    listLocalSkills(): Promise<readonly ILocalSkillListItem[]>
    validateSkill(skill: ISkillDefinitionDTO): Promise<IValidationResultDTO>
}

export class DesktopSkillClient implements IDesktopSkillClient {
    private getBridge(): NonNullable<typeof window.agenthubDesktop> {
        if (!window.agenthubDesktop) {
            throw new Error('Desktop bridge not initialized. Ensure getDesktopExtendedBridge() was called.')
        }
        return window.agenthubDesktop
    }

    async saveSkill(skill: ISkillDefinitionDTO, bump?: 'patch' | 'minor' | 'major'): Promise<ISkillSaveResult> {
        const payload: ISkillSavePayload = { skill, bump }
        return this.getBridge().skillBuilder.save(payload)
    }

    async loadSkill(skillId: string): Promise<ISkillLoadResult | null> {
        return this.getBridge().skillBuilder.load(skillId)
    }

    async deleteSkill(skillId: string): Promise<void> {
        return this.getBridge().skillBuilder.delete(skillId)
    }

    async listLocalSkills(): Promise<readonly ILocalSkillListItem[]> {
        return this.getBridge().skillBuilder.listLocal()
    }

    async validateSkill(skill: ISkillDefinitionDTO): Promise<IValidationResultDTO> {
        return this.getBridge().skillBuilder.validate(skill)
    }
}
