/**
 * ActingEngine — tool-oriented execution engine.
 *
 * Executes skeleton steps and micro actions with:
 * - Capability validation
 * - Tool execution via ToolExecutor
 * - Structured ExecutionResult output
 * - Memory change tracking
 * - Full capability check logging
 *
 * Main process only. No renderer imports.
 */

import type {
    ExecutionResult,
    ToolCallRecord,
    MemoryDelta,
    CapabilityCheck,
} from './ActingTypes.js'
import type { SkeletonStep } from '../planning/PlanningTypes.js'
import { ToolExecutor } from './ToolExecutor.js'

let executionCounter = 0

function nextExecutionId(): string {
    executionCounter++
    return `exec_${executionCounter.toString().padStart(6, '0')}`
}

export class ActingEngine {
    private readonly toolExecutor = new ToolExecutor()

    async executeStep(
        step: SkeletonStep,
        agentCapabilities: readonly string[],
    ): Promise<ExecutionResult> {
        const executionId = nextExecutionId()
        const toolCalls: ToolCallRecord[] = []
        const memoryChanges: MemoryDelta[] = []
        const capabilityChecks: CapabilityCheck[] = []

        try {
            const { record, capabilityChecks: checks } = await this.toolExecutor.execute(
                step.toolName,
                step.input,
                agentCapabilities,
            )

            toolCalls.push(record)
            capabilityChecks.push(...checks)

            memoryChanges.push({
                key: `step_${step.stepId}_result`,
                previousValue: null,
                newValue: record.output,
            })

            return {
                executionId,
                agent: step.agentId,
                toolCalls,
                memoryChanges,
                capabilityChecks,
                status: 'completed',
            }
        } catch (err) {
            return {
                executionId,
                agent: step.agentId,
                toolCalls,
                memoryChanges,
                capabilityChecks,
                status: 'failed',
            }
        }
    }

    async executeMicro(
        actions: readonly string[],
        agentId: string,
        agentCapabilities: readonly string[],
    ): Promise<ExecutionResult> {
        const executionId = nextExecutionId()
        const toolCalls: ToolCallRecord[] = []
        const memoryChanges: MemoryDelta[] = []
        const capabilityChecks: CapabilityCheck[] = []

        try {
            for (const action of actions) {
                const { record, capabilityChecks: checks } = await this.toolExecutor.execute(
                    action,
                    {},
                    agentCapabilities,
                )

                toolCalls.push(record)
                capabilityChecks.push(...checks)

                memoryChanges.push({
                    key: `micro_${action}_result`,
                    previousValue: null,
                    newValue: record.output,
                })
            }

            return {
                executionId,
                agent: agentId,
                toolCalls,
                memoryChanges,
                capabilityChecks,
                status: 'completed',
            }
        } catch {
            return {
                executionId,
                agent: agentId,
                toolCalls,
                memoryChanges,
                capabilityChecks,
                status: 'failed',
            }
        }
    }

    getToolExecutor(): ToolExecutor {
        return this.toolExecutor
    }
}
