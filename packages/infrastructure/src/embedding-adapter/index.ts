import type { MemoryDomain } from '@agenthub/core'

type IEmbeddingStrategy = MemoryDomain.IEmbeddingStrategy

export class EmbeddingAdapter implements IEmbeddingStrategy {
    readonly dimensions: number

    private readonly _generator: (text: string) => Promise<readonly number[]>

    constructor(
        dimensions: number,
        generator: (text: string) => Promise<readonly number[]>
    ) {
        this.dimensions = dimensions
        this._generator = generator
    }

    async embed(text: string): Promise<readonly number[]> {
        return this._generator(text)
    }

    async embedBatch(texts: readonly string[]): Promise<ReadonlyArray<readonly number[]>> {
        const results: Array<readonly number[]> = []
        for (const text of texts) {
            results.push(await this._generator(text))
        }
        return results
    }
}
