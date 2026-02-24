/**
 * MockLLMProvider — deterministic mock LLM for testing.
 *
 * Returns predefined responses based on configured scenarios.
 */

import type { ModelDomain } from '@agenthub/core'

type IModelProviderPort = ModelDomain.IModelProviderPort
type IModelRequest = ModelDomain.IModelRequest
type IModelResponse = ModelDomain.IModelResponse
type IModelStreamChunk = ModelDomain.IModelStreamChunk
type ModelCapability = ModelDomain.ModelCapability

export interface IMockLLMResponse {
    readonly content: string
    readonly toolCalls?: readonly ModelDomain.IModelToolCall[]
    readonly promptTokens?: number
    readonly completionTokens?: number
    readonly latencyMs?: number
}

export class MockLLMProvider implements IModelProviderPort {
    readonly id = 'mock-llm'
    readonly name = 'Mock LLM Provider'
    readonly capabilities: readonly ModelCapability[] = ['text-generation', 'function-calling', 'streaming']

    private responseQueue: IMockLLMResponse[] = []
    private defaultResponse: IMockLLMResponse = {
        content: 'Mock response',
        promptTokens: 10,
        completionTokens: 20,
        latencyMs: 50,
    }
    private callLog: IModelRequest[] = []

    enqueueResponse(response: IMockLLMResponse): void {
        this.responseQueue.push(response)
    }

    enqueueResponses(responses: readonly IMockLLMResponse[]): void {
        this.responseQueue.push(...responses)
    }

    setDefaultResponse(response: IMockLLMResponse): void {
        this.defaultResponse = response
    }

    getCallLog(): readonly IModelRequest[] {
        return [...this.callLog]
    }

    clearCallLog(): void {
        this.callLog = []
    }

    reset(): void {
        this.responseQueue = []
        this.callLog = []
        this.defaultResponse = {
            content: 'Mock response',
            promptTokens: 10,
            completionTokens: 20,
            latencyMs: 50,
        }
    }

    async generate(request: IModelRequest): Promise<IModelResponse> {
        this.callLog.push(request)

        const mockResponse = this.responseQueue.shift() ?? this.defaultResponse
        const latencyMs = mockResponse.latencyMs ?? 50

        if (latencyMs > 0) {
            await new Promise(resolve => setTimeout(resolve, latencyMs))
        }

        return {
            model: request.model,
            provider: this.id,
            content: mockResponse.content,
            toolCalls: mockResponse.toolCalls ? [...mockResponse.toolCalls] : undefined,
            usage: {
                promptTokens: mockResponse.promptTokens ?? 10,
                completionTokens: mockResponse.completionTokens ?? 20,
                totalTokens: (mockResponse.promptTokens ?? 10) + (mockResponse.completionTokens ?? 20),
            },
            finishReason: mockResponse.toolCalls ? 'tool_calls' : 'stop',
            latencyMs,
        }
    }

    async *stream(request: IModelRequest): AsyncIterable<IModelStreamChunk> {
        this.callLog.push(request)

        const mockResponse = this.responseQueue.shift() ?? this.defaultResponse
        const words = mockResponse.content.split(' ')

        for (let i = 0; i < words.length; i++) {
            const isLast = i === words.length - 1
            yield {
                content: words[i] + (isLast ? '' : ' '),
                done: isLast,
                usage: isLast ? {
                    promptTokens: mockResponse.promptTokens ?? 10,
                    completionTokens: mockResponse.completionTokens ?? 20,
                    totalTokens: (mockResponse.promptTokens ?? 10) + (mockResponse.completionTokens ?? 20),
                } : undefined,
            }
        }
    }

    async listModels(): Promise<readonly string[]> {
        return ['mock-model-v1', 'mock-model-v2']
    }

    supportsModel(_modelId: string): boolean {
        return true
    }

    async healthCheck(): Promise<boolean> {
        return true
    }
}
