/**
 * ToolExecutor — validates capability and executes tools with structured events.
 *
 * Flow:
 * 1. Resolve tool from ToolRegistry
 * 2. Validate capability via CapabilityGuard
 * 3. Execute tool
 * 4. Emit structured ToolCallRecord
 *
 * Main process only. No renderer access.
 */

import type { ToolCallRecord, CapabilityCheck } from './ActingTypes.js'
import { CapabilityGuard } from './CapabilityGuard.js'
import { getToolRegistry } from './ToolRegistry.js'
import { logger } from '@agenthub/shared'

const log = logger.child('ToolExecutor')

export interface ToolExecutionEvent {
    readonly type: 'tool:executed' | 'tool:failed' | 'tool:capability_denied'
    readonly record: ToolCallRecord | null
    readonly capabilityCheck: CapabilityCheck | null
    readonly error: string | null
}

export type ToolEventCallback = (event: ToolExecutionEvent) => void

export class ToolExecutor {
    private readonly guard = new CapabilityGuard()
    private readonly eventListeners = new Set<ToolEventCallback>()

    onEvent(callback: ToolEventCallback): () => void {
        this.eventListeners.add(callback)
        return () => {
            this.eventListeners.delete(callback)
        }
    }

    private emit(event: ToolExecutionEvent): void {
        for (const listener of this.eventListeners) {
            listener(event)
        }
    }

    async execute(
        toolName: string,
        input: unknown,
        agentCapabilities: readonly string[],
    ): Promise<{ record: ToolCallRecord; capabilityChecks: readonly CapabilityCheck[] }> {
        const registry = getToolRegistry()
        const tool = registry.getTool(toolName)

        if (!tool) {
            throw new Error(`Tool not found: ${toolName}`)
        }

        const checkResult = this.guard.check(agentCapabilities, tool.requiredCapabilities)

        const capabilityChecks: CapabilityCheck[] = tool.requiredCapabilities.map((cap) => ({
            capability: cap,
            required: true,
            granted: agentCapabilities.includes(cap),
        }))

        if (!checkResult.granted) {
            const deniedCheck: CapabilityCheck = {
                capability: checkResult.missing.join(', '),
                required: true,
                granted: false,
            }

            this.emit({
                type: 'tool:capability_denied',
                record: null,
                capabilityCheck: deniedCheck,
                error: `Missing capabilities: ${checkResult.missing.join(', ')}`,
            })

            this.guard.ensure(agentCapabilities, tool.requiredCapabilities)
        }

        const start = Date.now()
        try {
            const output = await tool.execute(input)
            const durationMs = Date.now() - start

            const record: ToolCallRecord = {
                toolName,
                input,
                output,
                durationMs,
                timestamp: new Date().toISOString(),
            }

            this.emit({
                type: 'tool:executed',
                record,
                capabilityCheck: null,
                error: null,
            })

            return { record, capabilityChecks }
        } catch (err) {
            const durationMs = Date.now() - start
            const errorMessage = err instanceof Error ? err.message : String(err)

            const record: ToolCallRecord = {
                toolName,
                input,
                output: null,
                durationMs,
                timestamp: new Date().toISOString(),
            }

            this.emit({
                type: 'tool:failed',
                record,
                capabilityCheck: null,
                error: errorMessage,
            })

            throw err
        }
    }

    removeAllListeners(): void {
        this.eventListeners.clear()
    }

    /**
     * Dispose of all resources - prevents memory leaks
     */
    dispose(): void {
        this.removeAllListeners()
        log.info('ToolExecutor disposed')
    }
}
