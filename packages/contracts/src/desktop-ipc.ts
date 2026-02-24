/**
 * Desktop IPC Contracts — typed channels and payloads for desktop main ↔ renderer.
 *
 * These extend the base IPC types with desktop-specific channels for:
 * - Execution playground
 * - Agent/skill builder
 * - Snapshot management
 * - Versioning
 *
 * All payloads are serializable DTOs from @agenthub/contracts.
 */

import type {
    IAgentDefinitionDTO,
    ISkillDefinitionDTO,
    IValidationResultDTO,
} from './definition-dto.js'
import type { ISnapshotDTO, ISnapshotSummaryDTO, IReplayRequestDTO, IReplayResultDTO } from './snapshot-dto.js'
import type { IExecutionEvent, ExecutionState } from './execution-events.js'

// ─── Desktop IPC Channel Names ──────────────────────────────────────────────

export type DesktopIPCChannel =
    | 'execution:start'
    | 'execution:stop'
    | 'execution:replay'
    | 'execution:state'
    | 'execution:event'
    | 'agent:save'
    | 'agent:load'
    | 'agent:delete'
    | 'agent:list-local'
    | 'agent:validate'
    | 'skill:save'
    | 'skill:load'
    | 'skill:delete'
    | 'skill:list-local'
    | 'skill:validate'
    | 'snapshot:list'
    | 'snapshot:load'
    | 'snapshot:delete'
    | 'snapshot:replay'
    | 'version:history'
    | 'version:bump'
    | 'filesystem:read'
    | 'filesystem:write'
    | 'filesystem:delete'
    | 'filesystem:list'
    | 'planning:create'
    | 'planning:micro'
    | 'acting:executeStep'
    | 'acting:executeMicro'
    | 'metrics:getExecutionSummary'
    | 'metrics:getDailyUsage'
    | 'metrics:getAgentBreakdown'
    | 'metrics:getAllExecutions'
    | 'metrics:exportReport'
    | 'metrics:getSummary'
    | 'metrics:getTokens'
    | 'metrics:getCosts'
    | 'metrics:getAgents'
    | 'metrics:getExecutions'
    | 'metrics:getTools'
    | 'metrics:getModels'
    | 'metrics:export'
    | 'workspace:initialize'
    | 'workspace:create'
    | 'workspace:delete'
    | 'workspace:rename'
    | 'workspace:switch'
    | 'workspace:list'
    | 'workspace:getActive'
    | 'workspace:duplicate'

// ─── Execution IPC Payloads ─────────────────────────────────────────────────

export interface IExecutionStartPayload {
    readonly agentId: string
    readonly input: Record<string, unknown>
}

export interface IExecutionStartResult {
    readonly executionId: string
    readonly status: ExecutionState
}

export interface IExecutionStopPayload {
    readonly executionId: string
}

export interface IExecutionStateResult {
    readonly executionId: string
    readonly state: ExecutionState
    readonly currentNodeId: string | null
    readonly stepCount: number
    readonly tokenUsage: {
        readonly promptTokens: number
        readonly completionTokens: number
    }
}

// ─── Execution Event Stream ─────────────────────────────────────────────────

export type ExecutionStreamEvent =
    | { readonly type: 'ExecutionCreated'; readonly executionId: string; readonly agentId: string; readonly timestamp: string }
    | { readonly type: 'ExecutionValidated'; readonly executionId: string; readonly timestamp: string }
    | { readonly type: 'ExecutionPlanned'; readonly executionId: string; readonly nodeCount: number; readonly timestamp: string }
    | { readonly type: 'ExecutionScheduled'; readonly executionId: string; readonly timestamp: string }
    | { readonly type: 'NodeStarted'; readonly executionId: string; readonly nodeId: string; readonly nodeType: string; readonly timestamp: string }
    | { readonly type: 'NodeCompleted'; readonly executionId: string; readonly nodeId: string; readonly result: unknown; readonly durationMs: number; readonly timestamp: string }
    | { readonly type: 'ToolCalled'; readonly executionId: string; readonly nodeId: string; readonly toolName: string; readonly input: Record<string, unknown>; readonly timestamp: string }
    | { readonly type: 'MemoryInjected'; readonly executionId: string; readonly nodeId: string; readonly memoryType: string; readonly itemCount: number; readonly timestamp: string }
    | { readonly type: 'CapabilityChecked'; readonly executionId: string; readonly capability: string; readonly granted: boolean; readonly timestamp: string }
    | { readonly type: 'ExecutionCompleted'; readonly executionId: string; readonly result: unknown; readonly totalTokens: number; readonly timestamp: string }
    | { readonly type: 'ExecutionFailed'; readonly executionId: string; readonly error: string; readonly timestamp: string }
    | { readonly type: 'SnapshotPersisted'; readonly executionId: string; readonly snapshotId: string; readonly timestamp: string }

// ─── Agent Builder IPC Payloads ─────────────────────────────────────────────

export interface IAgentSavePayload {
    readonly agent: IAgentDefinitionDTO
    readonly bump?: 'patch' | 'minor' | 'major' | undefined
}

export interface IAgentSaveResult {
    readonly agentId: string
    readonly version: string
    readonly validation: IValidationResultDTO
}

export interface IAgentLoadResult {
    readonly agent: IAgentDefinitionDTO
    readonly versionHistory: readonly IVersionRecordDTO[]
}

// ─── Skill Builder IPC Payloads ─────────────────────────────────────────────

export interface ISkillSavePayload {
    readonly skill: ISkillDefinitionDTO
    readonly bump?: 'patch' | 'minor' | 'major' | undefined
}

export interface ISkillSaveResult {
    readonly skillId: string
    readonly version: string
    readonly validation: IValidationResultDTO
}

export interface ISkillLoadResult {
    readonly skill: ISkillDefinitionDTO
    readonly versionHistory: readonly IVersionRecordDTO[]
}

// ─── Snapshot IPC Payloads ──────────────────────────────────────────────────

export interface ISnapshotLoadResult {
    readonly snapshot: ISnapshotDTO
    readonly events: readonly IExecutionEvent[]
}

// ─── Versioning IPC Payloads ────────────────────────────────────────────────

export interface IVersionRecordDTO {
    readonly entityId: string
    readonly entityType: 'agent' | 'skill'
    readonly version: string
    readonly previousVersion: string | null
    readonly bump: 'patch' | 'minor' | 'major'
    readonly createdAt: string
}

export interface IVersionHistoryDTO {
    readonly entityId: string
    readonly entityType: 'agent' | 'skill'
    readonly versions: readonly IVersionRecordDTO[]
    readonly currentVersion: string
}

export interface IVersionBumpPayload {
    readonly entityId: string
    readonly entityType: 'agent' | 'skill'
    readonly bump: 'patch' | 'minor' | 'major'
}

export interface IVersionBumpResult {
    readonly entityId: string
    readonly newVersion: string
    readonly previousVersion: string | null
}

// ─── Agent/Skill List Items ─────────────────────────────────────────────────

export interface ILocalAgentListItem {
    readonly id: string
    readonly name: string
    readonly version: string
    readonly description: string
    readonly category: string | undefined
    readonly author: string | undefined
    readonly icon: string | undefined
    readonly updatedAt: string | undefined
}

export interface ILocalSkillListItem {
    readonly id: string
    readonly name: string
    readonly version: string
    readonly description: string
    readonly type: string
    readonly category: string
    readonly author: string | undefined
    readonly icon: string | undefined
    readonly updatedAt: string | undefined
}

// ─── Planning IPC Payloads ──────────────────────────────────────────────────

export type PlanningMode = 'SKELETON' | 'MICRO'

export interface ISkeletonStepDTO {
    readonly stepId: string
    readonly agentId: string
    readonly action: string
    readonly toolName: string
    readonly input: Record<string, unknown>
    readonly expectedOutput: string
}

export interface ISkeletonPlanDTO {
    readonly planId: string
    readonly mode: 'SKELETON'
    readonly steps: readonly ISkeletonStepDTO[]
    readonly estimatedTokens: number
    readonly createdAt: string
}

export interface IDirectExecutePlanDTO {
    readonly planId: string
    readonly mode: 'DIRECT'
    readonly agentId: string
    readonly action: string
    readonly createdAt: string
}

export interface IMicroActionDTO {
    readonly actionId: string
    readonly toolName: string
    readonly input: Record<string, unknown>
    readonly expectedOutput: string
}

export interface IMicroPlanDTO {
    readonly planId: string
    readonly stepId: string
    readonly actions: readonly IMicroActionDTO[]
    readonly estimatedTokens: number
    readonly createdAt: string
}

export interface IPlanningCreatePayload {
    readonly input: string
    readonly agents: readonly IPlanningAgentCandidateDTO[]
    readonly budget: IPlanningBudgetDTO
}

export interface IPlanningAgentCandidateDTO {
    readonly agentId: string
    readonly name: string
    readonly capabilities: readonly string[]
    readonly costPerToken: number
}

export interface IPlanningBudgetDTO {
    readonly maxTokens: number
    readonly maxSteps: number
    readonly maxDepth: number
}

export interface IPlanningCreateResult {
    readonly plan: ISkeletonPlanDTO | IDirectExecutePlanDTO
}

export interface IPlanningMicroPayload {
    readonly step: ISkeletonStepDTO
    readonly budget: IPlanningBudgetDTO
}

export interface IPlanningMicroResult {
    readonly microPlan: IMicroPlanDTO
}

// ─── Acting IPC Payloads ────────────────────────────────────────────────────

export interface IToolCallRecordDTO {
    readonly toolName: string
    readonly input: unknown
    readonly output: unknown
    readonly durationMs: number
    readonly timestamp: string
}

export interface IMemoryDeltaDTO {
    readonly key: string
    readonly previousValue: unknown
    readonly newValue: unknown
}

export interface ICapabilityCheckDTO {
    readonly capability: string
    readonly required: boolean
    readonly granted: boolean
}

export interface IActingExecutionResultDTO {
    readonly executionId: string
    readonly agent: string
    readonly toolCalls: readonly IToolCallRecordDTO[]
    readonly memoryChanges: readonly IMemoryDeltaDTO[]
    readonly capabilityChecks: readonly ICapabilityCheckDTO[]
    readonly status: 'completed' | 'failed'
}

export interface IActingExecuteStepPayload {
    readonly step: ISkeletonStepDTO
    readonly agentCapabilities: readonly string[]
}

export interface IActingExecuteStepResult {
    readonly result: IActingExecutionResultDTO
}

export interface IActingExecuteMicroPayload {
    readonly actions: readonly string[]
    readonly agentId: string
    readonly agentCapabilities: readonly string[]
}

export interface IActingExecuteMicroResult {
    readonly result: IActingExecutionResultDTO
}
