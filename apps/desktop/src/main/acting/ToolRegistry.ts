/**
 * ToolRegistry — singleton registry for all available tools.
 *
 * Main process only. Tools must not be accessible from renderer.
 * Deterministic registration and retrieval.
 */

import type { ToolDefinition } from './ActingTypes.js'

export class ToolRegistry {
    private readonly tools = new Map<string, ToolDefinition>()

    registerTool(tool: ToolDefinition): void {
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool already registered: ${tool.name}`)
        }
        this.tools.set(tool.name, tool)
    }

    getTool(name: string): ToolDefinition | undefined {
        return this.tools.get(name)
    }

    hasTool(name: string): boolean {
        return this.tools.has(name)
    }

    listTools(): readonly ToolDefinition[] {
        return Array.from(this.tools.values())
    }

    unregisterTool(name: string): boolean {
        return this.tools.delete(name)
    }

    clear(): void {
        this.tools.clear()
    }

    getToolCount(): number {
        return this.tools.size
    }
}

let _registry: ToolRegistry | null = null

export function getToolRegistry(): ToolRegistry {
    if (!_registry) {
        _registry = new ToolRegistry()
    }
    return _registry
}
