/**
 * ProviderRegistry — concrete implementation.
 *
 * Named registration of LLM providers. Runtime resolves providers by name
 * for each agent execution.
 */

import type { ILLMProvider, IProviderRegistry } from './index.js'
import { logger } from '@agenthub/shared'

const log = logger.child('ProviderRegistry')

export class ProviderRegistry implements IProviderRegistry {
    private readonly providers = new Map<string, ILLMProvider>()

    register(name: string, provider: ILLMProvider): void {
        if (!name || name.trim().length === 0) {
            throw new Error('Provider name must be a non-empty string')
        }
        if (this.providers.has(name)) {
            log.warn('Overwriting existing provider registration', { name })
        }
        this.providers.set(name, provider)
        log.info('Provider registered', { name })
    }

    get(name: string): ILLMProvider {
        const provider = this.providers.get(name)
        if (!provider) {
            throw new Error(
                `Provider "${name}" not found. Available: [${this.list().join(', ')}]`,
            )
        }
        return provider
    }

    has(name: string): boolean {
        return this.providers.has(name)
    }

    list(): string[] {
        return Array.from(this.providers.keys())
    }
}
