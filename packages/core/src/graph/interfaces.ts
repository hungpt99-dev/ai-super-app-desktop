/**
 * Graph Execution Engine — interfaces for the DAG-based execution model.
 *
 * See: docs/technical-design.md §4 GRAPH EXECUTION ENGINE
 */

// ─── Node Types ─────────────────────────────────────────────────────────────

export type NodeType =
    | 'LLM_NODE'
    | 'TOOL_NODE'
    | 'MEMORY_READ_NODE'
    | 'MEMORY_WRITE_NODE'
    | 'AGENT_CALL_NODE'
    | 'CONDITION_NODE'
    | 'HUMAN_APPROVAL_NODE'
    | 'PARALLEL_NODE'
    | 'END_NODE'

// ─── Graph Structure ────────────────────────────────────────────────────────

export interface IGraphNode {
    readonly id: string
    readonly type: NodeType
    readonly config: Record<string, unknown>
    /**
     * Maximum iterations for this node if it's part of a cycle.
     * Required when the graph contains a cycle back to this node.
     * Omit for acyclic paths.
     *
     * See: docs/technical-design.md §4.1
     * "No infinite loops unless explicitly declared."
     */
    readonly maxIterations?: number
}

export interface IGraphEdge {
    readonly from: string
    readonly to: string
    /** Optional condition expression for CONDITION_NODE edges. */
    readonly condition?: string
}

export interface IGraphDefinition {
    readonly nodes: IGraphNode[]
    readonly edges: IGraphEdge[]
}

// ─── Graph Validation ───────────────────────────────────────────────────────

export interface IGraphValidationResult {
    readonly valid: boolean
    readonly errors: string[]
}

// ─── Graph Engine Interface ─────────────────────────────────────────────────

export interface IGraphEngine {
    /**
     * Validate a graph definition:
     * - No unreachable nodes
     * - No infinite cycles unless max_iterations defined
     * - All referenced nodes exist
     */
    validate(graph: IGraphDefinition): IGraphValidationResult

    /**
     * Execute a validated graph, advancing node by node.
     * Returns the ID of the next node to execute (null when END_NODE reached).
     */
    resolveNextNode(graph: IGraphDefinition, currentNodeId: string, variables: Record<string, unknown>): string | null
}

// ─── Graph Execution Config ─────────────────────────────────────────────────

/**
 * Execution model config per §4.1:
 * - Graph-based deterministic execution
 * - No infinite loops unless explicitly declared (maxIterations)
 */
export interface IGraphExecutionConfig {
    /** Global max iterations for the entire graph execution. Default: 1000. */
    readonly maxTotalIterations: number
    /** Default max iterations per node when maxIterations is not set. Default: 10. */
    readonly defaultNodeMaxIterations: number
}
