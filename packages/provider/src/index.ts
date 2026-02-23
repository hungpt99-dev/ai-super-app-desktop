/**
 * Provider Package — LLM provider abstraction layer.
 *
 * API-only design. AgentHub does NOT host or train models.
 * Each provider implements a mapping layer; runtime is provider-agnostic.
 *
 * See: docs/technical-design.md §3.2 PROVIDER ABSTRACTION LAYER
 */

// ─── Chat Message ───────────────────────────────────────────────────────────

export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface IChatMessage {
    readonly role: ChatMessageRole
    readonly content: string
    readonly name?: string
    readonly toolCallId?: string
}

// ─── Tool Schema ────────────────────────────────────────────────────────────

export interface IToolSchema {
    readonly name: string
    readonly description: string
    readonly inputSchema: Record<string, unknown>
}

// ─── Tool Call ──────────────────────────────────────────────────────────────

export interface IToolCall {
    readonly id: string
    readonly name: string
    readonly arguments: Record<string, unknown>
}

// ─── LLM Request ────────────────────────────────────────────────────────────

export interface ILLMRequest {
    readonly model: string
    readonly systemPrompt: string
    readonly messages: readonly IChatMessage[]
    readonly temperature: number
    readonly maxTokens: number
    readonly tools?: readonly IToolSchema[]
}

// ─── LLM Response ───────────────────────────────────────────────────────────

export interface ILLMResponse {
    readonly content?: string
    readonly toolCalls?: readonly IToolCall[]
    readonly usage: {
        readonly promptTokens: number
        readonly completionTokens: number
    }
    readonly rawResponse: unknown
}

// ─── LLM Stream Chunk ───────────────────────────────────────────────────────

export interface ILLMChunk {
    readonly content?: string
    readonly toolCalls?: readonly IToolCall[]
    readonly done: boolean
}

// ─── LLM Provider Interface ────────────────────────────────────────────────

/**
 * The core provider interface. Each AI provider (OpenAI, Anthropic, Gemini, etc.)
 * implements this interface with its own mapping layer.
 */
export interface ILLMProvider {
    /** Non-streaming completion. */
    generate(request: ILLMRequest): Promise<ILLMResponse>
    /** Streaming completion. */
    generateStream(request: ILLMRequest): AsyncIterable<ILLMChunk>
    /** Generate vector embedding for a block of text (§5.4). */
    embed(text: string): Promise<number[]>
}

// ─── Provider Registry ──────────────────────────────────────────────────────

export interface IProviderRegistry {
    /** Register a named provider implementation. */
    register(name: string, provider: ILLMProvider): void
    /** Get a provider by name. Throws if not found. */
    get(name: string): ILLMProvider
    /** Check if a provider is registered. */
    has(name: string): boolean
    /** List all registered provider names. */
    list(): string[]
}

// ─── Re-export concrete implementation ──────────────────────────────────────

export { ProviderRegistry } from './provider-registry.js'

// ─── Provider Fallback ──────────────────────────────────────────────────────

/**
 * Provider fallback chain for failure recovery.
 *
 * When the primary provider fails (rate limit, outage, timeout),
 * the runtime tries the next provider in the fallback chain.
 *
 * See: docs/technical-design.md §16 FAILURE RECOVERY
 */
export interface IProviderFallback {
    /** Ordered list of provider names to try. First = primary. */
    readonly chain: readonly string[]
    /** Maximum retry attempts per provider. */
    readonly maxRetries: number
    /** Base delay between retries in milliseconds. */
    readonly retryDelayMs: number
    /**
     * Resolve a provider from the chain. Tries each in order;
     * returns the first successful response.
     */
    executeWithFallback(request: ILLMRequest): Promise<ILLMResponse>
}

// ─── Concrete Implementations ───────────────────────────────────────────────

export { OpenaiProviderAdapter } from './openai/index.js'
export { ProviderFallback } from './fallback/index.js'
export { OpenAiEmbeddingService } from './embedding/index.js'
