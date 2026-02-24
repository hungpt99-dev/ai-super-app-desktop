/**
 * ImportExportService — pure logic for serializing/deserializing agent and skill definitions.
 *
 * Does NOT directly call Tauri APIs — the UI layer handles file dialogs.
 * This service handles validation, diffing, and JSON transformation.
 */

import type {
    IAgentDefinitionDTO,
    ISkillDefinitionDTO,
    IValidationResultDTO,
} from '@agenthub/contracts'
import { validateAgentDefinition, validateSkillDefinition } from './definition-validator.js'
import { BUILTIN_CAPABILITIES } from './capability-enforcer.js'

// ─── Export ─────────────────────────────────────────────────────────────────

export interface IExportEnvelope {
    readonly format: 'agenthub-definition'
    readonly version: '1.0'
    readonly exportedAt: string
    readonly type: 'agent' | 'skill'
    readonly data: IAgentDefinitionDTO | ISkillDefinitionDTO
}

export function exportAgentToJSON(agent: IAgentDefinitionDTO): string {
    const envelope: IExportEnvelope = {
        format: 'agenthub-definition',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        type: 'agent',
        data: agent,
    }
    return JSON.stringify(envelope, null, 2)
}

export function exportSkillToJSON(skill: ISkillDefinitionDTO): string {
    const envelope: IExportEnvelope = {
        format: 'agenthub-definition',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        type: 'skill',
        data: skill,
    }
    return JSON.stringify(envelope, null, 2)
}

// ─── Import ─────────────────────────────────────────────────────────────────

export interface IImportResult<T> {
    readonly success: boolean
    readonly data?: T
    readonly validation?: IValidationResultDTO
    readonly error?: string
}

export function importAgentFromJSON(json: string): IImportResult<IAgentDefinitionDTO> {
    try {
        const parsed = JSON.parse(json) as Record<string, unknown>

        // Check envelope format
        if (parsed['format'] === 'agenthub-definition' && parsed['type'] === 'agent') {
            const data = parsed['data'] as IAgentDefinitionDTO
            const validation = validateAgentDefinition(data, BUILTIN_CAPABILITIES)
            return { success: validation.valid, data, validation }
        }

        // Try direct parse (no envelope)
        const data = parsed as unknown as IAgentDefinitionDTO
        if (data.id && data.name && data.version && data.capabilities) {
            const validation = validateAgentDefinition(data, BUILTIN_CAPABILITIES)
            return { success: validation.valid, data, validation }
        }

        return { success: false, error: 'Invalid agent definition format.' }
    } catch (e) {
        return { success: false, error: `Failed to parse JSON: ${(e as Error).message}` }
    }
}

export function importSkillFromJSON(json: string): IImportResult<ISkillDefinitionDTO> {
    try {
        const parsed = JSON.parse(json) as Record<string, unknown>

        // Check envelope format
        if (parsed['format'] === 'agenthub-definition' && parsed['type'] === 'skill') {
            const data = parsed['data'] as ISkillDefinitionDTO
            const validation = validateSkillDefinition(data, BUILTIN_CAPABILITIES)
            return { success: validation.valid, data, validation }
        }

        // Try direct parse (no envelope)
        const data = parsed as unknown as ISkillDefinitionDTO
        if (data.id && data.name && data.version && data.requiredCapabilities) {
            const validation = validateSkillDefinition(data, BUILTIN_CAPABILITIES)
            return { success: validation.valid, data, validation }
        }

        return { success: false, error: 'Invalid skill definition format.' }
    } catch (e) {
        return { success: false, error: `Failed to parse JSON: ${(e as Error).message}` }
    }
}

// ─── Diff Preview ───────────────────────────────────────────────────────────

export interface IDiffEntry {
    readonly field: string
    readonly oldValue: unknown
    readonly newValue: unknown
    readonly changed: boolean
}

export function diffAgentDefinitions(
    existing: IAgentDefinitionDTO,
    incoming: IAgentDefinitionDTO,
): readonly IDiffEntry[] {
    const keys: (keyof IAgentDefinitionDTO)[] = [
        'name', 'version', 'description', 'capabilities', 'permissions',
        'memoryConfig', 'tools', 'skills', 'author', 'icon', 'category',
        'tags', 'maxTokenBudget', 'systemPrompt', 'model', 'signature',
    ]

    return keys.map((key) => {
        const oldVal = existing[key]
        const newVal = incoming[key]
        const oldStr = JSON.stringify(oldVal)
        const newStr = JSON.stringify(newVal)
        return {
            field: key,
            oldValue: oldVal,
            newValue: newVal,
            changed: oldStr !== newStr,
        }
    })
}

export function diffSkillDefinitions(
    existing: ISkillDefinitionDTO,
    incoming: ISkillDefinitionDTO,
): readonly IDiffEntry[] {
    const keys: (keyof ISkillDefinitionDTO)[] = [
        'name', 'version', 'description', 'requiredCapabilities', 'permissions',
        'tools', 'category', 'author', 'icon', 'tags', 'inputSchema',
        'outputSchema', 'signature',
    ]

    return keys.map((key) => {
        const oldVal = existing[key]
        const newVal = incoming[key]
        const oldStr = JSON.stringify(oldVal)
        const newStr = JSON.stringify(newVal)
        return {
            field: key,
            oldValue: oldVal,
            newValue: newVal,
            changed: oldStr !== newStr,
        }
    })
}
