/**
 * SkillDefinitionBuilder — fluent builder for creating SkillDefinitionDTO.
 *
 * Pure definition logic — no runtime dependencies.
 */

import type {
    ISkillDefinitionDTO,
    IToolConfigDTO,
} from '@agenthub/contracts'

export class SkillDefinitionBuilder {
    private _id = ''
    private _name = ''
    private _version = '1.0.0'
    private _description = ''
    private _requiredCapabilities: string[] = []
    private _permissions: string[] = []
    private _tools: IToolConfigDTO[] = []
    private _category = 'general'
    private _author?: string
    private _icon?: string
    private _tags: string[] = []
    private _inputSchema?: Record<string, unknown>
    private _outputSchema?: Record<string, unknown>
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

    requiredCapability(capability: string): this {
        if (!this._requiredCapabilities.includes(capability)) {
            this._requiredCapabilities.push(capability)
        }
        return this
    }

    requiredCapabilities(capabilities: readonly string[]): this {
        for (const cap of capabilities) {
            this.requiredCapability(cap)
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

    tool(tool: IToolConfigDTO): this {
        this._tools.push(tool)
        return this
    }

    category(category: string): this {
        this._category = category
        return this
    }

    author(author: string): this {
        this._author = author
        return this
    }

    icon(icon: string): this {
        this._icon = icon
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

    inputSchema(schema: Record<string, unknown>): this {
        this._inputSchema = schema
        return this
    }

    outputSchema(schema: Record<string, unknown>): this {
        this._outputSchema = schema
        return this
    }

    signature(signature: string): this {
        this._signature = signature
        return this
    }

    build(): ISkillDefinitionDTO {
        const now = new Date().toISOString()

        return {
            id: this._id || crypto.randomUUID(),
            name: this._name,
            version: this._version,
            description: this._description,
            requiredCapabilities: [...this._requiredCapabilities],
            permissions: [...this._permissions],
            tools: [...this._tools],
            category: this._category,
            author: this._author,
            icon: this._icon,
            tags: this._tags.length > 0 ? [...this._tags] : undefined,
            inputSchema: this._inputSchema,
            outputSchema: this._outputSchema,
            signature: this._signature,
            createdAt: now,
            updatedAt: now,
        }
    }
}

/**
 * Factory function to start building a skill definition.
 */
export function defineSkillDefinition(): SkillDefinitionBuilder {
    return new SkillDefinitionBuilder()
}
