import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry } from './tool-registry.js'
import type { IToolDefinition } from './index.js'

function makeTool(name: string): IToolDefinition {
    return {
        name,
        description: `Description for ${name}`,
        inputSchema: { type: 'object', properties: {} },
        timeoutMs: 5000,
    }
}

describe('ToolRegistry', () => {
    let registry: ToolRegistry

    beforeEach(() => {
        registry = new ToolRegistry()
    })

    it('registers and retrieves a tool', () => {
        const tool = makeTool('calculator')
        registry.register(tool)

        const result = registry.get('calculator')
        expect(result).not.toBeNull()
        expect(result!.name).toBe('calculator')
    })

    it('returns null for unknown tool', () => {
        expect(registry.get('nonexistent')).toBeNull()
    })

    it('throws on duplicate registration', () => {
        registry.register(makeTool('calculator'))

        expect(() => registry.register(makeTool('calculator'))).toThrow(
            'Tool "calculator" is already registered',
        )
    })

    it('has() checks existence correctly', () => {
        registry.register(makeTool('search'))

        expect(registry.has('search')).toBe(true)
        expect(registry.has('calculator')).toBe(false)
    })

    it('list() returns all tool names', () => {
        registry.register(makeTool('search'))
        registry.register(makeTool('calculator'))
        registry.register(makeTool('weather'))

        expect(registry.list()).toEqual(['search', 'calculator', 'weather'])
    })

    it('rejects empty tool name', () => {
        expect(() => registry.register(makeTool(''))).toThrow(
            'Tool name must be a non-empty string',
        )
    })

    it('freezes registered tool definitions', () => {
        const tool = makeTool('mutable')
        registry.register(tool)

        const retrieved = registry.get('mutable')!
        expect(() => {
            (retrieved as unknown as Record<string, unknown>)['name'] = 'hacked'
        }).toThrow() // Object.freeze prevents mutation
    })

    it('unregister() removes a tool', () => {
        registry.register(makeTool('temporary'))
        expect(registry.has('temporary')).toBe(true)

        registry.unregister('temporary')
        expect(registry.has('temporary')).toBe(false)
    })
})
