import { describe, it, expect, beforeEach } from 'vitest'
import { ProviderRegistry } from './provider-registry.js'
import type { ILLMProvider, ILLMRequest, ILLMResponse } from './interfaces.js'

/** Minimal mock provider for testing. */
function createMockProvider(name: string): ILLMProvider {
    return {
        async generate(_req: ILLMRequest): Promise<ILLMResponse> {
            return {
                content: `response from ${name}`,
                usage: { promptTokens: 10, completionTokens: 5 },
                rawResponse: {},
            }
        },
        async *generateStream() {
            yield { content: 'chunk', done: true }
        },
    }
}

describe('ProviderRegistry', () => {
    let registry: ProviderRegistry

    beforeEach(() => {
        registry = new ProviderRegistry()
    })

    it('registers and retrieves a provider', () => {
        const provider = createMockProvider('openai')
        registry.register('openai', provider)

        expect(registry.get('openai')).toBe(provider)
    })

    it('throws on unknown provider with helpful message', () => {
        registry.register('openai', createMockProvider('openai'))

        expect(() => registry.get('anthropic')).toThrow(
            'Provider "anthropic" not found. Available: [openai]',
        )
    })

    it('lists registered provider names', () => {
        registry.register('openai', createMockProvider('openai'))
        registry.register('anthropic', createMockProvider('anthropic'))

        expect(registry.list()).toEqual(['openai', 'anthropic'])
    })

    it('has() returns correct boolean', () => {
        registry.register('gemini', createMockProvider('gemini'))

        expect(registry.has('gemini')).toBe(true)
        expect(registry.has('openai')).toBe(false)
    })

    it('rejects empty provider name', () => {
        expect(() => registry.register('', createMockProvider('x'))).toThrow(
            'Provider name must be a non-empty string',
        )
    })

    it('allows overwriting an existing registration', () => {
        const original = createMockProvider('v1')
        const updated = createMockProvider('v2')

        registry.register('openai', original)
        registry.register('openai', updated)

        expect(registry.get('openai')).toBe(updated)
    })
})
