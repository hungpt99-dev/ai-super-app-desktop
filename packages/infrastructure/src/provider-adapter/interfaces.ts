import type { RuntimeDomain } from '@agenthub/core'

export type ILLMProvider = RuntimeDomain.ILLMProviderPort
export type ILLMRequest = RuntimeDomain.ILLMRequest
export type ILLMResponse = RuntimeDomain.ILLMResponse
export type ILLMChunk = RuntimeDomain.ILLMStreamChunk
export type IToolCall = RuntimeDomain.IToolCallResult

export interface IProviderRegistry {
    register(name: string, provider: ILLMProvider): void
    get(name: string): ILLMProvider
    has(name: string): boolean
    list(): string[]
}

export interface IProviderFallback {
    executeWithFallback(request: ILLMRequest): Promise<ILLMResponse>
}
