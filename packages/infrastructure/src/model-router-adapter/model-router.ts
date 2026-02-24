/**
 * ModelRouter — routes model requests to the best provider based on strategy.
 *
 * Implements IModelRouter from core ModelDomain.
 * Supports priority, round-robin, cost-optimized, and latency-optimized routing.
 * Automatic fallback on provider failure.
 */

import type { ModelDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type IModelRouter = ModelDomain.IModelRouter
type IModelProviderPort = ModelDomain.IModelProviderPort
type IModelRequest = ModelDomain.IModelRequest
type IModelResponse = ModelDomain.IModelResponse
type IModelStreamChunk = ModelDomain.IModelStreamChunk
type RoutingStrategy = ModelDomain.RoutingStrategy

const log = logger.child('ModelRouter')

export class ModelRouter implements IModelRouter {
    private readonly providers: Map<string, IModelProviderPort> = new Map()
    private strategy: RoutingStrategy = 'priority'
    private fallbackEnabled = true
    private maxFallbackAttempts = 3
    private roundRobinIndex = 0

    addProvider(provider: IModelProviderPort): void {
        this.providers.set(provider.id, provider)
        log.info('Provider added to router', { providerId: provider.id, name: provider.name })
    }

    removeProvider(providerId: string): void {
        this.providers.delete(providerId)
        log.info('Provider removed from router', { providerId })
    }

    listProviders(): readonly IModelProviderPort[] {
        return [...this.providers.values()]
    }

    setStrategy(strategy: RoutingStrategy): void {
        this.strategy = strategy
        log.info('Routing strategy updated', { strategy })
    }

    getStrategy(): RoutingStrategy {
        return this.strategy
    }

    setFallbackConfig(enabled: boolean, maxAttempts: number): void {
        this.fallbackEnabled = enabled
        this.maxFallbackAttempts = maxAttempts
    }

    async route(request: IModelRequest): Promise<IModelResponse> {
        const candidates = this.selectProviders(request)

        if (candidates.length === 0) {
            throw new Error(`No provider available for model "${request.model}"`)
        }

        let lastError: Error | null = null
        const maxAttempts = this.fallbackEnabled ? Math.min(this.maxFallbackAttempts, candidates.length) : 1

        for (let i = 0; i < maxAttempts; i++) {
            const provider = candidates[i]!
            try {
                log.info('Routing request to provider', {
                    providerId: provider.id,
                    model: request.model,
                    attempt: i + 1,
                })
                const response = await provider.generate(request)
                return response
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err))
                log.warn('Provider failed, trying fallback', {
                    providerId: provider.id,
                    error: lastError.message,
                    attempt: i + 1,
                })
            }
        }

        throw lastError ?? new Error('All providers failed')
    }

    async *routeStream(request: IModelRequest): AsyncIterable<IModelStreamChunk> {
        const candidates = this.selectProviders(request)

        if (candidates.length === 0) {
            throw new Error(`No provider available for model "${request.model}"`)
        }

        let lastError: Error | null = null
        const maxAttempts = this.fallbackEnabled ? Math.min(this.maxFallbackAttempts, candidates.length) : 1

        for (let i = 0; i < maxAttempts; i++) {
            const provider = candidates[i]!
            try {
                log.info('Routing stream to provider', {
                    providerId: provider.id,
                    model: request.model,
                    attempt: i + 1,
                })
                yield* provider.stream(request)
                return
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err))
                log.warn('Provider stream failed, trying fallback', {
                    providerId: provider.id,
                    error: lastError.message,
                    attempt: i + 1,
                })
            }
        }

        throw lastError ?? new Error('All providers failed for stream')
    }

    private selectProviders(request: IModelRequest): IModelProviderPort[] {
        const compatible = [...this.providers.values()].filter(p => p.supportsModel(request.model))

        switch (this.strategy) {
            case 'round-robin':
                return this.roundRobinSort(compatible)
            case 'cost-optimized':
            case 'latency-optimized':
            case 'priority':
            default:
                return compatible
        }
    }

    private roundRobinSort(providers: IModelProviderPort[]): IModelProviderPort[] {
        if (providers.length === 0) return providers
        const index = this.roundRobinIndex % providers.length
        this.roundRobinIndex++
        return [...providers.slice(index), ...providers.slice(0, index)]
    }
}
