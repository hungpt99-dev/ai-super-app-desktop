/**
 * Agent IPC Handler — manages agent definitions from renderer requests.
 *
 * Channels:
 * - agent:save      → validate + version + persist
 * - agent:load      → load agent definition + version history
 * - agent:delete    → delete agent + version history
 * - agent:list-local → list all local agents
 * - agent:validate  → validate agent definition
 */

import type {
    IAgentDefinitionDTO,
    IValidationResultDTO,
    IAgentSavePayload,
    IAgentSaveResult,
    IAgentLoadResult,
    ILocalAgentListItem,
    IVersionHistoryDTO,
} from '@agenthub/contracts'
import type { IFileStoragePort } from '@agenthub/contracts'
import type { SnapshotDomain, VersioningDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'
import { TauriFileStorageAdapter } from '../../bridges/tauri-file-storage.js'
import { SemanticVersioningAdapter } from '@agenthub/infrastructure'

const log = logger.child('AgentIPC')

const AGENTS_DIR = 'agents'

export class AgentIPCHandler {
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

    async save(payload: IAgentSavePayload): Promise<IAgentSaveResult> {
        const { agent, bump } = payload

        const validation = validateAgentDefinition(agent)
        if (!validation.valid) {
            return {
                agentId: agent.id,
                version: agent.version,
                validation,
            }
        }

        const versionBump = bump ?? 'patch'
        const newVersion = await this.versioning.bump(agent.id, 'agent', versionBump, {
            name: agent.name,
            capabilities: agent.capabilities,
        })

        const versionedAgent: IAgentDefinitionDTO = {
            ...agent,
            version: newVersion,
            updatedAt: new Date().toISOString(),
        }

        await this.storage.copyToVersionDir(AGENTS_DIR, `${agent.id}.json`, newVersion)
        await this.storage.writeJson(AGENTS_DIR, `${agent.id}.json`, versionedAgent)

        log.info('Agent saved', { agentId: agent.id, version: newVersion })

        return {
            agentId: agent.id,
            version: newVersion,
            validation,
        }
    }

    async load(agentId: string): Promise<IAgentLoadResult | null> {
        const agent = await this.storage.readJson<IAgentDefinitionDTO>(AGENTS_DIR, `${agentId}.json`)
        if (!agent) return null

        const history = await this.versioning.getHistory(agentId)
        const versionHistory = history?.versions.map(v => ({
            entityId: v.entityId,
            entityType: v.entityType,
            version: v.version,
            previousVersion: v.previousVersion,
            bump: v.bump,
            createdAt: v.createdAt,
        })) ?? []

        return { agent, versionHistory }
    }

    async delete(agentId: string): Promise<void> {
        await this.storage.deleteFile(AGENTS_DIR, `${agentId}.json`)
        await this.versioning.deleteHistory(agentId)
        log.info('Agent deleted', { agentId })
    }

    async listLocal(): Promise<readonly ILocalAgentListItem[]> {
        const agents = await this.storage.readAllJson<IAgentDefinitionDTO>(AGENTS_DIR)
        return agents.map(a => ({
            id: a.id,
            name: a.name,
            version: a.version,
            description: a.description,
            category: a.category,
            author: a.author,
            icon: a.icon,
            updatedAt: a.updatedAt,
        }))
    }

    async validate(agent: IAgentDefinitionDTO): Promise<IValidationResultDTO> {
        return validateAgentDefinition(agent)
    }
}

function validateAgentDefinition(agent: IAgentDefinitionDTO): IValidationResultDTO {
    const issues: Array<{ field: string; message: string; severity: 'error' | 'warning' | 'info'; code: string }> = []

    if (!agent.id || agent.id.trim() === '') {
        issues.push({ field: 'id', message: 'Agent ID is required', severity: 'error', code: 'REQUIRED_FIELD' })
    }
    if (!agent.name || agent.name.trim() === '') {
        issues.push({ field: 'name', message: 'Agent name is required', severity: 'error', code: 'REQUIRED_FIELD' })
    }
    if (!agent.version || !/^\d+\.\d+\.\d+/.test(agent.version)) {
        issues.push({ field: 'version', message: 'Version must be semver format', severity: 'error', code: 'INVALID_VERSION' })
    }
    if (!agent.description || agent.description.trim() === '') {
        issues.push({ field: 'description', message: 'Description is required', severity: 'error', code: 'REQUIRED_FIELD' })
    }
    if (agent.capabilities.length === 0) {
        issues.push({ field: 'capabilities', message: 'At least one capability should be declared', severity: 'warning', code: 'EMPTY_CAPABILITIES' })
    }
    if (agent.maxTokenBudget !== undefined && agent.maxTokenBudget <= 0) {
        issues.push({ field: 'maxTokenBudget', message: 'Token budget must be positive', severity: 'error', code: 'INVALID_BUDGET' })
    }

    for (const tool of agent.tools) {
        if (!tool.name || tool.name.trim() === '') {
            issues.push({ field: `tools.${tool.name}`, message: 'Tool name is required', severity: 'error', code: 'REQUIRED_FIELD' })
        }
    }

    for (const skill of agent.skills) {
        const missingCaps = skill.requiredCapabilities.filter(
            cap => !agent.capabilities.includes(cap),
        )
        if (missingCaps.length > 0) {
            issues.push({
                field: `skills.${skill.id}`,
                message: `Skill "${skill.name}" requires capabilities not declared by agent: ${missingCaps.join(', ')}`,
                severity: 'error',
                code: 'MISSING_CAPABILITY',
            })
        }
    }

    return {
        valid: issues.filter(i => i.severity === 'error').length === 0,
        issues,
        checkedAt: new Date().toISOString(),
    }
}

export const agentIPC = new AgentIPCHandler()
