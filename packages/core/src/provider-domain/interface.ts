/**
 * ProviderAdapter — the interface core uses for LLM providers.
 *
 * Convention: Interface = `XxxAdapter`, Implementation = `OpenaiProviderAdapter`.
 * See: docs/codebase.md Naming Convention
 */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export interface ChatMessage {
    readonly role: ChatRole
    readonly content: string
}

export interface ProviderRequest {
    readonly model: string
    readonly messages: readonly ChatMessage[]
    readonly temperature?: number
    readonly maxTokens?: number
}

export interface ProviderResponse {
    readonly content: string
    readonly usage: { readonly promptTokens: number; readonly completionTokens: number }
}

export interface ProviderAdapter {
    generate(request: ProviderRequest): Promise<ProviderResponse>
    generateStream(request: ProviderRequest): AsyncIterable<string>
}
