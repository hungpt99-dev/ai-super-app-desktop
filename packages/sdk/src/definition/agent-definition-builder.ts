/**
 * AgentDefinitionBuilder — fluent builder for creating AgentDefinitionDTO.
 *
 * Pure definition logic — no runtime dependencies.
 * Validates at definition level before saving.
 */

import type {
    IAgentDefinitionDTO,
    ISkillDefinitionDTO,
    IToolConfigDTO,
    IMemoryConfigDTO,
    MemoryScope,
} from '@agenthub/contracts'

export class AgentDefinitionBuilder {
    private _id = ''
    private _name = ''
    private _version = '1.0.0'
    private _description = ''
    private _capabilities: string[] = []
    private _permissions: string[] = []
    private _memoryConfig: IMemoryConfigDTO = {
        enabled: false,
        scopes: [],
    }
    private _tools: IToolConfigDTO[] = []
    private _skills: ISkillDefinitionDTO[] = []
    private _author?: string
    private _icon?: string
    private _category?: string
    private _tags: string[] = []
    private _maxTokenBudget?: number
    private _systemPrompt?: string
    private _model?: string
    private _signature?: string

    id(id: string): this {
        this._id = id
        return this
    }

    name(name: string): this {
        this._name = name
        return this
    }

    version(version: string): this {
        this._version = version
        return this
    }

    description(description: string): this {
        this._description = description
        return this
    }

    capability(capability: string): this {
        if (!this._capabilities.includes(capability)) {
            this._capabilities.push(capability)
        }
        return this
    }

    capabilities(capabilities: readonly string[]): this {
        for (const cap of capabilities) {
            this.capability(cap)
        }
        return this
    }

    permission(permission: string): this {
        if (!this._permissions.includes(permission)) {
            this._permissions.push(permission)
        }
        return this
    }

    permissions(permissions: readonly string[]): this {
        for (const perm of permissions) {
            this.permission(perm)
        }
        return this
    }

    memoryConfig(config: IMemoryConfigDTO): this {
        this._memoryConfig = config
        return this
    }

    enableMemory(scopes: readonly MemoryScope[], options?: {
        readonly maxEntriesPerScope?: number
        readonly persistAcrossSessions?: boolean
    }): this {
        this._memoryConfig = {
            enabled: true,
            scopes,
            maxEntriesPerScope: options?.maxEntriesPerScope,
            persistAcrossSessions: options?.persistAcrossSessions,
        }
        return this
    }

    tool(tool: IToolConfigDTO): this {
        this._tools.push(tool)
        return this
    }

    skill(skill: ISkillDefinitionDTO): this {
        this._skills.push(skill)
        return this
    }

    attachSkill(skill: ISkillDefinitionDTO): this {
        return this.skill(skill)
    }

    author(author: string): this {
        this._author = author
        return this
    }

    icon(icon: string): this {
        this._icon = icon
        return this
    }

    category(category: string): this {
        this._category = category
        return this
    }

    tag(tag: string): this {
        if (!this._tags.includes(tag)) {
            this._tags.push(tag)
        }
        return this
    }

    tags(tags: readonly string[]): this {
        for (const t of tags) {
            this.tag(t)
        }
        return this
    }

    maxTokenBudget(budget: number): this {
        this._maxTokenBudget = budget
        return this
    }

    systemPrompt(prompt: string): this {
        this._systemPrompt = prompt
        return this
    }

    model(model: string): this {
        this._model = model
        return this
    }

    signature(signature: string): this {
        this._signature = signature
        return this
    }

    build(): IAgentDefinitionDTO {
        const now = new Date().toISOString()

        return {
            id: this._id || crypto.randomUUID(),
            name: this._name,
            version: this._version,
            description: this._description,
            capabilities: [...this._capabilities],
            permissions: [...this._permissions],
            memoryConfig: { ...this._memoryConfig },
            tools: [...this._tools],
            skills: [...this._skills],
            author: this._author,
            icon: this._icon,
            category: this._category,
            tags: this._tags.length > 0 ? [...this._tags] : undefined,
            maxTokenBudget: this._maxTokenBudget,
            systemPrompt: this._systemPrompt,
            model: this._model,
            signature: this._signature,
            createdAt: now,
            updatedAt: now,
        }
    }
}

/**
 * Factory function to start building an agent definition.
 */
export function defineAgentDefinition(): AgentDefinitionBuilder {
    return new AgentDefinitionBuilder()
}
