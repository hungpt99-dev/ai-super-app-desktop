/**
 * ToolRegistry — concrete implementation.
 *
 * Registers tool definitions and provides lookup by name.
 * Prevents duplicate registration to catch configuration errors early.
 */

import type { IToolDefinition, IToolRegistry } from './index.js'
import { logger } from '@agenthub/shared'

const log = logger.child('ToolRegistry')

export class ToolRegistry implements IToolRegistry {
    private readonly tools = new Map<string, IToolDefinition>()

    register(tool: IToolDefinition): void {
        if (!tool.name || tool.name.trim().length === 0) {
            throw new Error('Tool name must be a non-empty string')
        }
        if (this.tools.has(tool.name)) {
            throw new Error(
                `Tool "${tool.name}" is already registered. Use a unique name or unregister first.`,
            )
        }
        this.tools.set(tool.name, Object.freeze({ ...tool }))
        log.info('Tool registered', { name: tool.name })
    }

    get(name: string): IToolDefinition | null {
        return this.tools.get(name) ?? null
    }

    has(name: string): boolean {
        return this.tools.has(name)
    }

    list(): string[] {
        return Array.from(this.tools.keys())
    }

    /** Remove a tool by name. Returns true if the tool existed. */
    unregister(name: string): boolean {
        const existed = this.tools.delete(name)
        if (existed) log.info('Tool unregistered', { name })
        return existed
    }
}
