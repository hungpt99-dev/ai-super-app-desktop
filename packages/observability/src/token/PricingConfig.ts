/**
 * PricingConfig — model pricing registry for cost calculation.
 *
 * Prices are per 1K tokens. Must support runtime override.
 * No hardcoded prices in business logic.
 */

export interface ModelPricing {
    readonly promptPer1K: number
    readonly completionPer1K: number
}

export type PricingMap = Record<string, ModelPricing>

const DEFAULT_PRICING: PricingMap = {
    'gpt-4o': { promptPer1K: 0.0025, completionPer1K: 0.01 },
    'gpt-4o-mini': { promptPer1K: 0.00015, completionPer1K: 0.0006 },
    'gpt-4-turbo': { promptPer1K: 0.01, completionPer1K: 0.03 },
    'gpt-3.5-turbo': { promptPer1K: 0.0005, completionPer1K: 0.0015 },
    'claude-3-5-sonnet-20241022': { promptPer1K: 0.003, completionPer1K: 0.015 },
    'claude-3-5-haiku-20241022': { promptPer1K: 0.001, completionPer1K: 0.005 },
    'claude-3-opus-20240229': { promptPer1K: 0.015, completionPer1K: 0.075 },
    'gemini-1.5-pro': { promptPer1K: 0.00125, completionPer1K: 0.005 },
    'gemini-1.5-flash': { promptPer1K: 0.000075, completionPer1K: 0.0003 },
    'gemini-2.0-flash': { promptPer1K: 0.0001, completionPer1K: 0.0004 },
} as const

export class PricingConfig {
    private readonly prices: Map<string, ModelPricing>

    constructor(overrides?: PricingMap) {
        this.prices = new Map<string, ModelPricing>()
        for (const [model, pricing] of Object.entries(DEFAULT_PRICING)) {
            this.prices.set(model, pricing)
        }
        if (overrides) {
            for (const [model, pricing] of Object.entries(overrides)) {
                this.prices.set(model, pricing)
            }
        }
    }

    getPricing(model: string): ModelPricing {
        const pricing = this.prices.get(model)
        if (pricing) return pricing
        const fuzzy = Array.from(this.prices.entries()).find(([key]) =>
            model.startsWith(key) || key.startsWith(model),
        )
        if (fuzzy) return fuzzy[1]
        return { promptPer1K: 0, completionPer1K: 0 }
    }

    setModelPricing(model: string, pricing: ModelPricing): void {
        this.prices.set(model, pricing)
    }

    getAllPricing(): PricingMap {
        const result: Record<string, ModelPricing> = {}
        for (const [model, pricing] of this.prices) {
            result[model] = pricing
        }
        return result
    }

    hasModel(model: string): boolean {
        return this.prices.has(model)
    }
}
