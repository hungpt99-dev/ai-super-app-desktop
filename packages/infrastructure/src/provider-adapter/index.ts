import type { RuntimeDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type ILLMProviderPort = RuntimeDomain.ILLMProviderPort
type ILLMRequest = RuntimeDomain.ILLMRequest
type ILLMResponse = RuntimeDomain.ILLMResponse
type ILLMStreamChunk = RuntimeDomain.ILLMStreamChunk

export class ProviderAdapter implements ILLMProviderPort {
    private readonly _providers: Map<string, ILLMProviderPort> = new Map()
    private _defaultProvider: string | null = null

    register(name: string, provider: ILLMProviderPort): void {
        this._providers.set(name, provider)
        if (this._defaultProvider === null) {
            this._defaultProvider = name
        }
        logger.info(`Provider registered: ${name}`)
    }

    setDefault(name: string): void {
        if (!this._providers.has(name)) {
            throw new Error(`Provider not found: ${name}`)
        }
        this._defaultProvider = name
    }

    async generate(request: ILLMRequest): Promise<ILLMResponse> {
        const provider = this._resolveProvider()
        return provider.generate(request)
    }

    async *generateStream(request: ILLMRequest): AsyncIterable<ILLMStreamChunk> {
        const provider = this._resolveProvider()
        yield* provider.generateStream(request)
    }

    has(name: string): boolean {
        return this._providers.has(name)
    }

    list(): string[] {
        return Array.from(this._providers.keys())
    }

    private _resolveProvider(): ILLMProviderPort {
        if (this._defaultProvider === null) {
            throw new Error('No providers registered')
        }
        const provider = this._providers.get(this._defaultProvider)
        if (!provider) {
            throw new Error(`Default provider not found: ${this._defaultProvider}`)
        }
        return provider
    }
}
export { ProviderRegistry } from './provider-registry.js'
export { OpenaiProviderAdapter } from './openai/index.js'
export { ProviderFallback } from './fallback/index.js'
export { OpenAiEmbeddingService } from './embedding/index.js'
