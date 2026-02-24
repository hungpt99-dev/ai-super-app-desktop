/**
 * CostCalculator — deterministic token-to-cost conversion.
 *
 * Uses PricingConfig. Never hardcodes prices.
 * All calculations are pure functions.
 */

import type { ModelPricing } from './PricingConfig.js'
import { PricingConfig } from './PricingConfig.js'

export class CostCalculator {
    private readonly pricing: PricingConfig

    constructor(pricing?: PricingConfig) {
        this.pricing = pricing ?? new PricingConfig()
    }

    calculateCost(model: string, promptTokens: number, completionTokens: number): number {
        const p = this.pricing.getPricing(model)
        const promptCost = (promptTokens / 1000) * p.promptPer1K
        const completionCost = (completionTokens / 1000) * p.completionPer1K
        return Math.round((promptCost + completionCost) * 1_000_000) / 1_000_000
    }

    calculatePromptCost(model: string, promptTokens: number): number {
        const p = this.pricing.getPricing(model)
        return Math.round(((promptTokens / 1000) * p.promptPer1K) * 1_000_000) / 1_000_000
    }

    calculateCompletionCost(model: string, completionTokens: number): number {
        const p = this.pricing.getPricing(model)
        return Math.round(((completionTokens / 1000) * p.completionPer1K) * 1_000_000) / 1_000_000
    }

    getModelPricing(model: string): ModelPricing {
        return this.pricing.getPricing(model)
    }

    getPricingConfig(): PricingConfig {
        return this.pricing
    }
}
