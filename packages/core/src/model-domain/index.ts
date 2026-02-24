/**
 * ModelDomain — core ports for model provider abstraction, routing,
 * capability detection, cost calculation, and fallback strategies.
 */

// ─── Model Provider Types ───────────────────────────────────────────────────

export type ModelCapability = 'text-generation' | 'code-generation' | 'embedding' | 'vision' | 'function-calling' | 'streaming'

export interface IModelProviderConfig {
    readonly id: string
    readonly name: string
    readonly baseUrl?: string
    readonly apiKeyRef?: string
    readonly models: readonly string[]
    readonly capabilities: readonly ModelCapability[]
    readonly maxRetries: number
    readonly timeoutMs: number
    readonly priority: number
}

export interface IModelRequest {
    readonly model: string
    readonly messages: readonly IModelMessage[]
    readonly temperature?: number
    readonly maxTokens?: number
    readonly tools?: readonly Record<string, unknown>[]
    readonly stream?: boolean
}

export interface IModelMessage {
    readonly role: 'system' | 'user' | 'assistant' | 'tool'
    readonly content: string
    readonly toolCallId?: string
}

export interface IModelResponse {
    readonly model: string
    readonly provider: string
    readonly content: string
    readonly toolCalls?: readonly IModelToolCall[]
    readonly usage: IModelUsage
    readonly finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter'
    readonly latencyMs: number
}

export interface IModelToolCall {
    readonly id: string
    readonly name: string
    readonly arguments: string
}

export interface IModelUsage {
    readonly promptTokens: number
    readonly completionTokens: number
    readonly totalTokens: number
}

export interface IModelStreamChunk {
    readonly content: string
    readonly done: boolean
    readonly usage?: IModelUsage
}

// ─── Model Provider Port ────────────────────────────────────────────────────

export interface IModelProviderPort {
    readonly id: string
    readonly name: string
    readonly capabilities: readonly ModelCapability[]
    generate(request: IModelRequest): Promise<IModelResponse>
    stream(request: IModelRequest): AsyncIterable<IModelStreamChunk>
    listModels(): Promise<readonly string[]>
    supportsModel(modelId: string): boolean
    healthCheck(): Promise<boolean>
}

// ─── Model Router ───────────────────────────────────────────────────────────

export type RoutingStrategy = 'priority' | 'round-robin' | 'cost-optimized' | 'latency-optimized'

export interface IModelRouterConfig {
    readonly strategy: RoutingStrategy
    readonly fallbackEnabled: boolean
    readonly maxFallbackAttempts: number
}

export interface IModelRouter {
    route(request: IModelRequest): Promise<IModelResponse>
    routeStream(request: IModelRequest): AsyncIterable<IModelStreamChunk>
    addProvider(provider: IModelProviderPort): void
    removeProvider(providerId: string): void
    listProviders(): readonly IModelProviderPort[]
    setStrategy(strategy: RoutingStrategy): void
    getStrategy(): RoutingStrategy
}

// ─── Cost Calculator ────────────────────────────────────────────────────────

export interface ITokenPricing {
    readonly modelId: string
    readonly provider: string
    readonly inputPricePerToken: number
    readonly outputPricePerToken: number
    readonly currency: string
    readonly updatedAt: string
}

export interface ICostEstimate {
    readonly modelId: string
    readonly estimatedInputTokens: number
    readonly estimatedOutputTokens: number
    readonly estimatedCost: number
    readonly currency: string
}

export interface ICostCalculator {
    estimate(modelId: string, inputTokens: number, outputTokens: number): ICostEstimate
    calculateActual(modelId: string, usage: IModelUsage): number
    setPricing(pricing: ITokenPricing): void
    getPricing(modelId: string): ITokenPricing | null
    listPricing(): readonly ITokenPricing[]
}
