export type NodeType =
    | 'LLM_NODE'
    | 'TOOL_NODE'
    | 'MEMORY_READ_NODE'
    | 'MEMORY_WRITE_NODE'
    | 'AGENT_CALL_NODE'
    | 'CONDITION_NODE'
    | 'HUMAN_APPROVAL_NODE'
    | 'PARALLEL_NODE'
    | 'START_NODE'
    | 'END_NODE'

export interface IGraphNode {
    readonly id: string
    readonly type: NodeType
    readonly config: Readonly<Record<string, unknown>>
    readonly maxIterations?: number
}

export interface IGraphEdge {
    readonly from: string
    readonly to: string
    readonly condition?: string
}

export interface IGraphDefinition {
    readonly id: string
    readonly nodes: readonly IGraphNode[]
    readonly edges: readonly IGraphEdge[]
}

export interface IGraphValidationResult {
    readonly valid: boolean
    readonly errors: readonly string[]
}
