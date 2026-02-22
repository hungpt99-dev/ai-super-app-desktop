import type { IEmbeddingService } from '../index.js'

export class OpenAiEmbeddingService implements IEmbeddingService {
    readonly dimensions = 1536 // text-embedding-ada-002

    constructor(private readonly apiKey: string) { }

    async embed(text: string): Promise<number[]> {
        const res = await this.embedBatch([text])
        if (!res[0]) throw new Error('No embedding returned')
        return res[0]
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: texts,
                model: 'text-embedding-ada-002'
            })
        })

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`)
        }

        const data = await response.json() as { data: Array<{ embedding: number[] }> }
        return data.data.map(d => d.embedding)
    }
}
