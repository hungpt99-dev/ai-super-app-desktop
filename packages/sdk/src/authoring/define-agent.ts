import type { AgentDomain, GraphDomain } from '@agenthub/core'

type IAgentDefinition = AgentDomain.IAgentDefinition
type IGraphDefinition = GraphDomain.IGraphDefinition
type IGraphEdge = GraphDomain.IGraphEdge
type IGraphNode = GraphDomain.IGraphNode
type NodeType = GraphDomain.NodeType

export interface IAgentBlueprint {
    readonly definition: IAgentDefinition
    readonly graph: IGraphDefinition
}

export interface IAgentBuilderNodeConfig {
    readonly id: string
    readonly type: NodeType
    readonly config?: Readonly<Record<string, unknown>> | undefined
}

export interface IAgentBuilderEdgeConfig {
    readonly from: string
    readonly to: string
    readonly condition?: string | undefined
}

export class AgentBuilder {
    private _name = ''
    private _description = ''
    private _maxTokenBudget = 100_000
    private _capabilities: string[] = []
    private _nodes: IAgentBuilderNodeConfig[] = []
    private _edges: IAgentBuilderEdgeConfig[] = []

    name(name: string): this {
        this._name = name
        return this
    }

    description(description: string): this {
        this._description = description
        return this
    }

    maxTokenBudget(budget: number): this {
        this._maxTokenBudget = budget
        return this
    }

    capability(name: string): this {
        this._capabilities.push(name)
        return this
    }

    node(id: string, type: NodeType, config?: Readonly<Record<string, unknown>>): this {
        this._nodes.push({ id, type, config })
        return this
    }

    edge(from: string, to: string, condition?: string): this {
        this._edges.push({ from, to, condition })
        return this
    }

    build(): IAgentBlueprint {
        if (!this._name) throw new Error('Agent name is required')

        const graphId = `${this._name}-graph`

        const graph: IGraphDefinition = {
            id: graphId,
            nodes: this._nodes.map((n): IGraphNode => {
                const node: IGraphNode = { id: n.id, type: n.type, config: n.config ?? {} }
                return node
            }),
            edges: this._edges.map((e): IGraphEdge => {
                if (e.condition !== undefined) {
                    return { from: e.from, to: e.to, condition: e.condition }
                }
                return { from: e.from, to: e.to }
            }),
        }

        const definition: IAgentDefinition = {
            id: this._name,
            name: this._name,
            description: this._description,
            graphId,
            maxTokenBudget: this._maxTokenBudget,
            requiredCapabilities: this._capabilities,
        }

        return { definition, graph }
    }
}

export function defineAgent(): AgentBuilder {
    return new AgentBuilder()
}
