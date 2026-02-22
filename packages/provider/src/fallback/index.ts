import type { IProviderFallback, ILLMRequest, ILLMResponse, IProviderRegistry, ILLMProvider } from '../index.js'
import { logger } from '@agenthub/shared'

const log = logger.child('ProviderFallback')

/**
 * ProviderFallback — simple retry/fallback mechanism.
 */
export class ProviderFallback implements IProviderFallback {
    constructor(
        public readonly chain: readonly string[],
        public readonly maxRetries: number = 2,
        public readonly retryDelayMs: number = 1000,
        private readonly registry: IProviderRegistry
    ) { }

    async executeWithFallback(request: ILLMRequest): Promise<ILLMResponse> {
        const errors: Error[] = []

        for (const providerName of this.chain) {
            if (!this.registry.has(providerName)) {
                log.warn(`Provider ${providerName} is not registered, skipping in fallback chain.`)
                continue
            }

            const provider = this.registry.get(providerName)

            for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
                try {
                    // Attempt the generation
                    return await provider.generate(request)
                } catch (error) {
                    const e = error as Error
                    log.warn(`Provider ${providerName} attempt ${attempt} failed: ${e.message}`)
                    errors.push(e)

                    if (attempt < this.maxRetries) {
                        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs))
                    }
                }
            }

            log.error(`Provider ${providerName} exhausted all retries. Falling back to next...`)
        }

        throw new Error(`All providers in fallback chain failed. Last error: ${errors[errors.length - 1]?.message}`)
    }
}
