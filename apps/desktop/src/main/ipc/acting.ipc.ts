/**
 * Acting IPC Handler — handles acting:executeStep and acting:executeMicro channels.
 *
 * Main process only. Dispatches to ActingEngine.
 */

import type {
    IActingExecuteStepPayload,
    IActingExecuteStepResult,
    IActingExecuteMicroPayload,
    IActingExecuteMicroResult,
} from '@agenthub/contracts'
import { ActingEngine } from '../acting/ActingEngine.js'
import { getToolRegistry } from '../acting/ToolRegistry.js'
import { ALL_BUILTIN_TOOLS } from '../acting/tools/builtin-tools.js'

const engine = new ActingEngine()

function ensureToolsRegistered(): void {
    const registry = getToolRegistry()
    for (const tool of ALL_BUILTIN_TOOLS) {
        if (!registry.hasTool(tool.name)) {
            registry.registerTool(tool)
        }
    }
}

export const actingIPC = {
    async executeStep(payload: IActingExecuteStepPayload): Promise<IActingExecuteStepResult> {
        ensureToolsRegistered()

        const step = {
            stepId: payload.step.stepId,
            agentId: payload.step.agentId,
            action: payload.step.action,
            toolName: payload.step.toolName,
            input: payload.step.input,
            expectedOutput: payload.step.expectedOutput,
        }

        const result = await engine.executeStep(step, [...payload.agentCapabilities])
        return {
            result: {
                executionId: result.executionId,
                agent: result.agent,
                toolCalls: result.toolCalls.map((tc) => ({
                    toolName: tc.toolName,
                    input: tc.input,
                    output: tc.output,
                    durationMs: tc.durationMs,
                    timestamp: tc.timestamp,
                })),
                memoryChanges: result.memoryChanges.map((mc) => ({
                    key: mc.key,
                    previousValue: mc.previousValue,
                    newValue: mc.newValue,
                })),
                capabilityChecks: result.capabilityChecks.map((cc) => ({
                    capability: cc.capability,
                    required: cc.required,
                    granted: cc.granted,
                })),
                status: result.status,
            },
        }
    },

    async executeMicro(payload: IActingExecuteMicroPayload): Promise<IActingExecuteMicroResult> {
        ensureToolsRegistered()

        const result = await engine.executeMicro(
            [...payload.actions],
            payload.agentId,
            [...payload.agentCapabilities],
        )

        return {
            result: {
                executionId: result.executionId,
                agent: result.agent,
                toolCalls: result.toolCalls.map((tc) => ({
                    toolName: tc.toolName,
                    input: tc.input,
                    output: tc.output,
                    durationMs: tc.durationMs,
                    timestamp: tc.timestamp,
                })),
                memoryChanges: result.memoryChanges.map((mc) => ({
                    key: mc.key,
                    previousValue: mc.previousValue,
                    newValue: mc.newValue,
                })),
                capabilityChecks: result.capabilityChecks.map((cc) => ({
                    capability: cc.capability,
                    required: cc.required,
                    granted: cc.granted,
                })),
                status: result.status,
            },
        }
    },
}
