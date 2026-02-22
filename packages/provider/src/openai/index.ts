import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/index.js'
import type { ILLMProvider, ILLMRequest, ILLMResponse, ILLMChunk, IToolCall } from '../index.js'

export class OpenaiProviderAdapter implements ILLMProvider {
    private client: OpenAI

    constructor(apiKey: string) {
        this.client = new OpenAI({ apiKey })
    }

    private mapRequest(request: ILLMRequest) {
        const messages: ChatCompletionMessageParam[] = [
            { role: 'system', content: request.systemPrompt },
            ...request.messages.map((m) => {
                if (m.role === 'tool') {
                    return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId! }
                }
                if (m.role === 'assistant') {
                    return { role: 'assistant' as const, content: m.content }
                }
                return { role: 'user' as const, content: m.content, ...(m.name ? { name: m.name } : {}) }
            })
        ]

        const tools: ChatCompletionTool[] | undefined = request.tools?.map((t) => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema as Record<string, unknown>
            }
        }))

        return { messages, tools }
    }

    async generate(request: ILLMRequest): Promise<ILLMResponse> {
        const { messages, tools } = this.mapRequest(request)

        const response = await this.client.chat.completions.create({
            model: request.model,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            messages,
            ...(tools?.length ? { tools } : {}),
        })

        const choice = response.choices[0]
        const toolCalls: IToolCall[] = []
        if (choice?.message.tool_calls) {
            for (const tc of choice.message.tool_calls) {
                if (tc.type === 'function') {
                    toolCalls.push({
                        id: tc.id,
                        name: tc.function.name,
                        arguments: JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>,
                    })
                }
            }
        }

        const res: ILLMResponse = {
            ...(choice?.message.content ? { content: choice.message.content } : {}),
            ...(toolCalls?.length ? { toolCalls } : {}),
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
            },
            rawResponse: response,
        }
        return res
    }

    async *generateStream(request: ILLMRequest): AsyncIterable<ILLMChunk> {
        const { messages, tools } = this.mapRequest(request)

        const stream = await this.client.chat.completions.create({
            model: request.model,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            messages,
            ...(tools?.length ? { tools } : {}),
            stream: true,
        })

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta
            const toolCalls: IToolCall[] = []
            if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                    if (tc.type === 'function' && tc.function) {
                        toolCalls.push({
                            id: tc.id || '',
                            name: tc.function.name || '',
                            arguments: tc.function.arguments ? (JSON.parse(tc.function.arguments) as Record<string, unknown>) : {},
                        })
                    }
                }
            }

            const chunkRes: ILLMChunk = {
                ...(delta?.content ? { content: delta.content } : {}),
                ...(toolCalls?.length ? { toolCalls } : {}),
                done: chunk.choices[0]?.finish_reason !== null && chunk.choices[0]?.finish_reason !== undefined,
            }
            yield chunkRes
        }
    }

    async embed(text: string): Promise<number[]> {
        const response = await this.client.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
        })
        if (!response.data || response.data.length === 0) {
            throw new Error('OpenAI embedding response was empty')
        }
        return response.data[0]!.embedding
    }
}
