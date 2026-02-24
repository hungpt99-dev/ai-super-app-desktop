/**
 * MockToolProvider — deterministic mock tool executor for testing.
 */

export interface IMockToolResponse {
    readonly output: unknown
    readonly error?: string
    readonly durationMs?: number
}

export class MockToolProvider {
    private readonly handlers: Map<string, IMockToolResponse[]> = new Map()
    private readonly defaultResponses: Map<string, IMockToolResponse> = new Map()
    private readonly callLog: Array<{ toolName: string; input: Record<string, unknown> }> = []

    setToolResponse(toolName: string, response: IMockToolResponse): void {
        this.defaultResponses.set(toolName, response)
    }

    enqueueToolResponse(toolName: string, response: IMockToolResponse): void {
        let queue = this.handlers.get(toolName)
        if (!queue) {
            queue = []
            this.handlers.set(toolName, queue)
        }
        queue.push(response)
    }

    getCallLog(): readonly Array<{ toolName: string; input: Record<string, unknown> }> {
        return [...this.callLog]
    }

    clearCallLog(): void {
        this.callLog.length = 0
    }

    reset(): void {
        this.handlers.clear()
        this.defaultResponses.clear()
        this.callLog.length = 0
    }

    async executeTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
        this.callLog.push({ toolName, input })

        const queue = this.handlers.get(toolName)
        const response = queue?.shift() ?? this.defaultResponses.get(toolName)

        if (!response) {
            return { result: `Mock result for ${toolName}` }
        }

        if (response.durationMs && response.durationMs > 0) {
            await new Promise(resolve => setTimeout(resolve, response.durationMs))
        }

        if (response.error) {
            throw new Error(response.error)
        }

        return response.output
    }
}
