import type { IGraphDefinition, IGraphValidationResult } from './types.js'

export interface IGraphEngine {
    validate(graph: IGraphDefinition): IGraphValidationResult
    resolveNextNode(
        graph: IGraphDefinition,
        currentNodeId: string,
        variables: Readonly<Record<string, unknown>>
    ): string | null
    topologicalOrder(graph: IGraphDefinition): readonly string[]
}

export interface IGraphExecutionConfig {
    readonly maxTotalIterations: number
    readonly defaultNodeMaxIterations: number
}
