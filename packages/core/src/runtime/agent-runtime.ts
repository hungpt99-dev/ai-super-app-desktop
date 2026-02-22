import type { IAgentRuntime, IAgentRuntimeConfig, IExecutionContext, ITokenUsage, IPermissionEngine } from './interfaces.js'
import type { ModuleManager } from './module-manager.js'

export class AgentRuntime implements IAgentRuntime {
    private readonly config: IAgentRuntimeConfig
    private readonly activeExecutions: Map<string, AbortController> = new Map()

    constructor(config: IAgentRuntimeConfig) {
        this.config = config
    }

    async execute(agentId: string, input: Record<string, unknown>): Promise<IExecutionContext> {
        // Resolve API Key from Vault if present
        if (this.config.secretVault) {
            const key = await this.config.secretVault.getActiveKey('openai')
            if (key) { (this.config.provider as any).apiKey = key }
        }

        const executionId = crypto.randomUUID()
        const abortController = new AbortController()
        this.activeExecutions.set(executionId, abortController)

        // Generate base context
        const context: IExecutionContext = {
            executionId,
            agentId,
            sessionId: crypto.randomUUID(),
            graphId: 'default',
            currentNodeId: 'start', // Should be resolved from manifesto/graph logic
            variables: { ...input },
            callStack: [],
            memoryScope: 'session',
            tokenUsage: { promptTokens: 0, completionTokens: 0, estimatedCost: 0 },
            budgetRemaining: 1.0, // Fixed default budget for MVP
        }

        try {
            // Persist the initial state
            await this.config.storage.set(`execution_${executionId}`, context)

            // 1. Resolve Graph
            let graph = {
                id: 'default',
                nodes: [
                    { id: 'start', type: 'START_NODE' as const },
                    { id: 'end', type: 'END_NODE' as const }
                ],
                edges: [
                    { from: 'start', to: 'end' }
                ]
            }

            // In a real system, we resolve the graph from the module manager
            if (this.config.moduleManager) {
                const active = this.config.moduleManager.getActive()
                const mod = active.get(agentId)
                if (mod && mod.manifest.graph) {
                    graph = mod.manifest.graph
                }
            }

            // In a real system, we would resolve the graph from the module manager.
            // For now we delegate to the DI'd scheduler.
            if (this.config.scheduler) {
                // Mock lifecycle
                const lifecycle = {
                    executionId,
                    state: 'running' as const,
                    abortSignal: abortController.signal,
                    env: {
                        provider: this.config.provider,
                        sandbox: this.config.sandbox,
                        permissionEngine: this.config.permissionEngine,
                        storage: this.config.storage,
                        vectorStore: this.config.vectorStore,
                    },
                    start: () => { },
                    pause: () => { },
                    cancel: () => { },
                    complete: () => { },
                    fail: () => { }
                }
                await this.config.scheduler.executeGraph(graph, context, lifecycle)
            }

            return context
        } finally {
            this.activeExecutions.delete(executionId)
        }
    }

    async resume(executionId: string): Promise<IExecutionContext> {
        const context = await this.config.storage.get<IExecutionContext>(`execution_${executionId}`)
        if (!context) {
            throw new Error(`Execution ${executionId} not found`)
        }
        return context
    }

    async abort(executionId: string): Promise<void> {
        const controller = this.activeExecutions.get(executionId)
        if (controller) {
            controller.abort()
            this.activeExecutions.delete(executionId)
        }
    }
}
