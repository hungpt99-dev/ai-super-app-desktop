/**
 * Window augmentation for desktop bridge.
 * Declares the global agenthubDesktop property on Window.
 */

import type {
    IAgentDefinitionDTO,
    ISkillDefinitionDTO,
    IValidationResultDTO,
    IAgentSavePayload,
    IAgentSaveResult,
    IAgentLoadResult,
    ILocalAgentListItem,
    ISkillSavePayload,
    ISkillSaveResult,
    ISkillLoadResult,
    ILocalSkillListItem,
    ISnapshotSummaryDTO,
    ISnapshotDTO,
    IReplayRequestDTO,
    IReplayResultDTO,
    ExecutionStreamEvent,
    IExecutionStartPayload,
    IExecutionStartResult,
    IExecutionStopPayload,
    IExecutionStateResult,
    IVersionHistoryDTO,
    IVersionBumpPayload,
    IVersionBumpResult,
} from '@agenthub/contracts'

interface IDesktopExecutionBridge {
    start(payload: IExecutionStartPayload): Promise<IExecutionStartResult>
    stop(payload: IExecutionStopPayload): Promise<void>
    replay(payload: IReplayRequestDTO): Promise<IReplayResultDTO>
    getState(executionId: string): Promise<IExecutionStateResult>
    onEvent(handler: (event: ExecutionStreamEvent) => void): () => void
}

interface IDesktopAgentBridge {
    save(payload: IAgentSavePayload): Promise<IAgentSaveResult>
    load(agentId: string): Promise<IAgentLoadResult | null>
    delete(agentId: string): Promise<void>
    listLocal(): Promise<readonly ILocalAgentListItem[]>
    validate(agent: IAgentDefinitionDTO): Promise<IValidationResultDTO>
}

interface IDesktopSkillBridge {
    save(payload: ISkillSavePayload): Promise<ISkillSaveResult>
    load(skillId: string): Promise<ISkillLoadResult | null>
    delete(skillId: string): Promise<void>
    listLocal(): Promise<readonly ILocalSkillListItem[]>
    validate(skill: ISkillDefinitionDTO): Promise<IValidationResultDTO>
}

interface IDesktopSnapshotBridge {
    list(): Promise<readonly ISnapshotSummaryDTO[]>
    load(executionId: string): Promise<ISnapshotDTO | null>
    delete(executionId: string): Promise<void>
    replay(payload: IReplayRequestDTO): Promise<IReplayResultDTO>
}

interface IDesktopVersionBridge {
    getHistory(entityId: string): Promise<IVersionHistoryDTO | null>
    bump(payload: IVersionBumpPayload): Promise<IVersionBumpResult>
}

interface IDesktopExtendedBridge {
    execution: IDesktopExecutionBridge
    agentBuilder: IDesktopAgentBridge
    skillBuilder: IDesktopSkillBridge
    snapshot: IDesktopSnapshotBridge
    version: IDesktopVersionBridge
}

declare global {
    interface Window {
        agenthubDesktop?: IDesktopExtendedBridge
    }
}

export {}
