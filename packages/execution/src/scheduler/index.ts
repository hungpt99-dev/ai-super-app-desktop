/**
 * scheduler/index.ts
 *
 * Implements the core graph execution loop algorithm (docs §4.3 Execution Flow).
 * Resolves the next node, executes it, saves snapshots, and handles transitions.
 *
 * Uses locally defined port types — NO @agenthub/core import.
 */

import type { IExecutionLifecycle } from '../lifecycle/index.js'
import { logger } from '@agenthub/shared'

const log = logger.child('GraphScheduler')

// ─── Local Graph Types ──────────────────────────────────────────────────────
// Mirrors core's graph types without importing from @agenthub/core.

export type ExecNodeType = 'LLM_NODE' | 'TOOL_NODE' | 'AGENT_CALL_NODE' | 'CONDITION_NODE' | 'START_NODE' | 'END_NODE'

export interface IExecGraphNode {
    readonly id: string
    readonly type: ExecNodeType | string
    readonly config?: Record<string, unknown>
}

export interface IExecGraphEdge {
    readonly from: string
    readonly to: string
    readonly condition?: string
}

export interface IExecGraphDefinition {
    readonly id: string
    readonly nodes: readonly IExecGraphNode[]
    readonly edges: readonly IExecGraphEdge[]
}

export interface IExecContext {
    executionId: string
    agentId: string
    currentNodeId: string | null
    variables: Record<string, unknown>
    tokenUsage: {
        promptTokens: number
        completionTokens: number
        estimatedCost: number
    }
    budgetRemaining: number
}

// ─── Graph Scheduler ────────────────────────────────────────────────────────

export interface IGraphScheduler {
    executeGraph(
        graph: IExecGraphDefinition,
        context: IExecContext,
        lifecycle: IExecutionLifecycle
    ): Promise<IExecContext>

    step(
        node: IExecGraphNode,
        context: IExecContext,
        lifecycle: IExecutionLifecycle
    ): Promise<void>
}

export class GraphScheduler implements IGraphScheduler {
    async executeGraph(
        graph: IExecGraphDefinition,
        context: IExecContext,
        lifecycle: IExecutionLifecycle
    ): Promise<IExecContext> {
        let iterations = 0
        const maxIterations = 1000 // A safe upper bound for runaway graph loops

        while (!lifecycle.signal.aborted && iterations < maxIterations) {
            const nodeId = context.currentNodeId
            if (!nodeId) break

            const node = graph.nodes.find(n => n.id === nodeId)
            if (!node) {
                log.warn(`Node ${nodeId} not found in graph, halting execution.`)
                break
            }

            if (node.type === 'END_NODE') {
                log.info(`Reached END_NODE ${nodeId}, completing execution.`)
                break
            }

            // Step 1: Budget Check
            if (context.budgetRemaining <= 0) {
                log.error(`Execution ${context.executionId} aborted: Budget exceeded.`)
                break
            }

            // Step 2: Execute Node
            await this.step(node, context, lifecycle)

            // Step 3: Persistence (Snapshot)
            await lifecycle.env.storage?.set(`execution_${context.executionId}`, context)

            // Step 4: Check Abort/Error
            if (lifecycle.signal.aborted) break

            // Step 5: Resolve Next Edge
            const nextNodeId = this.resolveNextNodeId(graph, node.id, context.variables)
            if (!nextNodeId) {
                log.info(`No valid outbound edge found from ${nodeId}, completing execution.`)
                break
            }

            context.currentNodeId = nextNodeId
            iterations++
        }

        if (iterations >= maxIterations) {
            log.warn(`Execution ${context.executionId} reached max total iterations (${maxIterations}). Possible infinite loop.`)
        }

        return context
    }

    async step(
        node: IExecGraphNode,
        context: IExecContext,
        lifecycle: IExecutionLifecycle
    ): Promise<void> {
        log.info(`Executing node [${node.id}] / type: ${node.type}`)

        switch (node.type) {
            case 'LLM_NODE': {
                log.info(`Checking permissions for LLM node ${node.id}`)
                lifecycle.env.permissionEngine.check(context.agentId, 'ai:generate')

                // 2. Fetch Semantic Memory (Docs §5.4 Retrieval Pipeline)
                let semanticContext = ''
                const provider = lifecycle.env.provider as any
                if (provider.embed && context.variables.input) {
                    try {
                        const vectorStore = (lifecycle.env as any).vectorStore
                        if (vectorStore) {
                            const embedding = await provider.embed(context.variables.input as string)
                            const memories = await vectorStore.search(embedding, 3)
                            semanticContext = memories.map((m: any) => m.content).join('\n---\n')
                            log.info(`Injected ${memories.length} semantic memories.`)
                        }
                    } catch (e) { log.warn('Memory retrieval failed', { error: e instanceof Error ? e.message : String(e) }) }
                }

                log.info(`Calling LLM provider for node ${node.id}`)
                const response = await lifecycle.env.provider.generate({
                    model: node.config?.model ?? 'gpt-4o-mini',
                    systemPrompt: (node.config?.systemPrompt ?? '') + (semanticContext ? `\n\nContext:\n${semanticContext}` : ''),
                    messages: [{ role: 'user', content: context.variables.input as string ?? '' }],
                    temperature: node.config?.temperature ?? 0.7,
                    maxTokens: node.config?.maxTokens ?? 2048,
                }) as any
                context.tokenUsage.promptTokens += response.usage?.promptTokens ?? 0
                context.tokenUsage.completionTokens += response.usage?.completionTokens ?? 0
                context.variables[String(node.config?.outputVar ?? 'last_response')] = response.content
                break
            }
            case 'TOOL_NODE': {
                log.info(`Checking permissions for Tool node ${node.id}`)
                lifecycle.env.permissionEngine.check(context.agentId, 'tool:execute')

                log.info(`Executing tool ${node.id} in sandbox`)
                const result = await lifecycle.env.sandbox.execute(String(node.config?.code ?? ''), context.variables as any)
                context.variables[String(node.config?.outputVar ?? 'last_tool_result')] = result
                break
            }
            case 'AGENT_CALL_NODE': {
                log.info(`Nesting execution for agent [${node.config?.agentId}]`)
                lifecycle.env.permissionEngine.check(context.agentId, 'agent_call')
                // This would recursively call AgentRuntime.execute once we have the runtime in env
                break
            }
            // Add other node type handling routing here
        }

        // Update estimated cost based on tokens (Simplified: $0.01 per 1k tokens)
        const totalTokens = context.tokenUsage.promptTokens + context.tokenUsage.completionTokens
        const newCost = (totalTokens / 1000) * 0.01
        const deltaCost = newCost - context.tokenUsage.estimatedCost
        context.tokenUsage.estimatedCost = newCost
        context.budgetRemaining -= deltaCost

        // Just yielding execution tick to prevent event loop blocking
        await new Promise(resolve => setTimeout(resolve, 10))
    }

    private resolveNextNodeId(graph: IExecGraphDefinition, currentNodeId: string, variables: Record<string, unknown>): string | null {
        const outboundEdges = graph.edges.filter(e => e.from === currentNodeId)
        if (outboundEdges.length === 0) return null

        if (outboundEdges.length === 1 && !outboundEdges[0]?.condition) {
            return outboundEdges[0]?.to ?? null
        }

        // Evaluate conditional edges
        for (const edge of outboundEdges) {
            if (!edge.condition) continue
            try {
                const [left, right] = edge.condition.split('==').map(s => s.trim())
                if (left && right) {
                    const varName = left.replace('var.', '')
                    if (String(variables[varName]) === right) {
                        return edge.to
                    }
                }
            } catch (err) {
                log.error(`Failed to evaluate condition ${edge.condition}`, { error: err })
            }
        }

        // Fallback to first unconditional edge if any
        return outboundEdges.find(e => !e?.condition)?.to ?? null
    }
}
