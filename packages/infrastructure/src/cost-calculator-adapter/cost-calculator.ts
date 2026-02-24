/**
 * CostCalculator — calculates token pricing and cost estimates.
 *
 * Implements ICostCalculator from core ModelDomain.
 */

import type { ModelDomain } from '@agenthub/core'

type ICostCalculator = ModelDomain.ICostCalculator
type ITokenPricing = ModelDomain.ITokenPricing
type ICostEstimate = ModelDomain.ICostEstimate
type IModelUsage = ModelDomain.IModelUsage

export class CostCalculator implements ICostCalculator {
    private readonly pricing: Map<string, ITokenPricing> = new Map()

    constructor() {
        this.initializeDefaultPricing()
    }

    private initializeDefaultPricing(): void {
        const defaults: ITokenPricing[] = [
            {
                modelId: 'gpt-4o',
                provider: 'openai',
                inputPricePerToken: 0.0000025,
                outputPricePerToken: 0.00001,
                currency: 'USD',
                updatedAt: new Date().toISOString(),
            },
            {
                modelId: 'gpt-4o-mini',
                provider: 'openai',
                inputPricePerToken: 0.00000015,
                outputPricePerToken: 0.0000006,
                currency: 'USD',
                updatedAt: new Date().toISOString(),
            },
            {
                modelId: 'claude-3-5-sonnet-20241022',
                provider: 'anthropic',
                inputPricePerToken: 0.000003,
                outputPricePerToken: 0.000015,
                currency: 'USD',
                updatedAt: new Date().toISOString(),
            },
            {
                modelId: 'claude-3-5-haiku-20241022',
                provider: 'anthropic',
                inputPricePerToken: 0.0000008,
                outputPricePerToken: 0.000004,
                currency: 'USD',
                updatedAt: new Date().toISOString(),
            },
        ]

        for (const p of defaults) {
            this.pricing.set(p.modelId, p)
        }
    }

    estimate(modelId: string, inputTokens: number, outputTokens: number): ICostEstimate {
        const pricing = this.pricing.get(modelId)

        if (!pricing) {
            return {
                modelId,
                estimatedInputTokens: inputTokens,
                estimatedOutputTokens: outputTokens,
                estimatedCost: 0,
                currency: 'USD',
            }
        }

        const cost = (inputTokens * pricing.inputPricePerToken) + (outputTokens * pricing.outputPricePerToken)

        return {
            modelId,
            estimatedInputTokens: inputTokens,
            estimatedOutputTokens: outputTokens,
            estimatedCost: Math.round(cost * 1_000_000) / 1_000_000,
            currency: pricing.currency,
        }
    }

    calculateActual(modelId: string, usage: IModelUsage): number {
        const pricing = this.pricing.get(modelId)
        if (!pricing) return 0

        const cost = (usage.promptTokens * pricing.inputPricePerToken) +
            (usage.completionTokens * pricing.outputPricePerToken)

        return Math.round(cost * 1_000_000) / 1_000_000
    }

    setPricing(pricing: ITokenPricing): void {
        this.pricing.set(pricing.modelId, pricing)
    }

    getPricing(modelId: string): ITokenPricing | null {
        return this.pricing.get(modelId) ?? null
    }

    listPricing(): readonly ITokenPricing[] {
        return [...this.pricing.values()]
    }
}
