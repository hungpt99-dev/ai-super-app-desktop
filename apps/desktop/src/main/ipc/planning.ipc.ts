/**
 * Planning IPC Handler — handles planning:create and planning:micro channels.
 *
 * Main process only. Dispatches to PlanningEngine.
 */

import type {
    IPlanningCreatePayload,
    IPlanningCreateResult,
    IPlanningMicroPayload,
    IPlanningMicroResult,
} from '@agenthub/contracts'
import { PlanningEngine } from '../planning/PlanningEngine.js'
import type { AgentCandidate, PlanningBudgetConfig } from '../planning/PlanningTypes.js'

const engine = new PlanningEngine()

export const planningIPC = {
    create(payload: IPlanningCreatePayload): IPlanningCreateResult {
        const agents: readonly AgentCandidate[] = payload.agents.map((a) => ({
            agentId: a.agentId,
            name: a.name,
            capabilities: a.capabilities,
            costPerToken: a.costPerToken,
        }))

        const budgetConfig: PlanningBudgetConfig = {
            maxTokens: payload.budget.maxTokens,
            maxSteps: payload.budget.maxSteps,
            maxDepth: payload.budget.maxDepth,
        }

        const plan = engine.createPlan(payload.input, agents, budgetConfig)
        return { plan }
    },

    micro(payload: IPlanningMicroPayload): IPlanningMicroResult {
        const step = {
            stepId: payload.step.stepId,
            agentId: payload.step.agentId,
            action: payload.step.action,
            toolName: payload.step.toolName,
            input: payload.step.input,
            expectedOutput: payload.step.expectedOutput,
        }

        const budgetConfig: PlanningBudgetConfig = {
            maxTokens: payload.budget.maxTokens,
            maxSteps: payload.budget.maxSteps,
            maxDepth: payload.budget.maxDepth,
        }

        const microPlan = engine.createMicroPlan(step, budgetConfig)
        return { microPlan }
    },
}
