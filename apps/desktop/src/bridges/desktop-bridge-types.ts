/**
 * Desktop Bridge Extension — typed API surface for desktop-specific IPC.
 *
 * Extends window.agenthub with execution, agent builder, skill builder,
 * and snapshot management APIs.
 *
 * No business logic. No direct core/execution/infrastructure imports.
 * Wraps Tauri invoke commands only.
 */

import type {
    IExecutionStartPayload,
    IExecutionStartResult,
    IExecutionStopPayload,
    IExecutionStateResult,
    ExecutionStreamEvent,
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
    IAgentDefinitionDTO,
    ISkillDefinitionDTO,
    IValidationResultDTO,
    IVersionHistoryDTO,
    IVersionBumpPayload,
    IVersionBumpResult,
    IPolicyEvaluatePayload,
    IPolicyEvaluateResult,
    IBudgetPayload,
    IBudgetResult,
    ISetBudgetPayload,
    IRateLimitPayload,
    ISetRateLimitPayload,
    IModelListResult,
    IModelActionPayload,
    IPluginInstallPayload,
    IPluginListResult,
    IPluginDetailResult,
    IWorkspaceCreatePayload,
    IWorkspaceResult,
    IWorkspaceListResult,
    ITestRunPayload,
    ITestRunAllPayload,
    ITestRunResult,
} from '@agenthub/contracts'

export interface IDesktopExecutionBridge {
    start(payload: IExecutionStartPayload): Promise<IExecutionStartResult>
    stop(payload: IExecutionStopPayload): Promise<void>
    replay(payload: IReplayRequestDTO): Promise<IReplayResultDTO>
    getState(executionId: string): Promise<IExecutionStateResult>
    onEvent(handler: (event: ExecutionStreamEvent) => void): () => void
}

export interface IDesktopAgentBridge {
    save(payload: IAgentSavePayload): Promise<IAgentSaveResult>
    load(agentId: string): Promise<IAgentLoadResult | null>
    delete(agentId: string): Promise<void>
    listLocal(): Promise<readonly ILocalAgentListItem[]>
    validate(agent: IAgentDefinitionDTO): Promise<IValidationResultDTO>
}

export interface IDesktopSkillBridge {
    save(payload: ISkillSavePayload): Promise<ISkillSaveResult>
    load(skillId: string): Promise<ISkillLoadResult | null>
    delete(skillId: string): Promise<void>
    listLocal(): Promise<readonly ILocalSkillListItem[]>
    validate(skill: ISkillDefinitionDTO): Promise<IValidationResultDTO>
}

export interface IDesktopSnapshotBridge {
    list(): Promise<readonly ISnapshotSummaryDTO[]>
    load(executionId: string): Promise<ISnapshotDTO | null>
    delete(executionId: string): Promise<void>
    replay(payload: IReplayRequestDTO): Promise<IReplayResultDTO>
}

export interface IDesktopVersionBridge {
    getHistory(entityId: string): Promise<IVersionHistoryDTO | null>
    bump(payload: IVersionBumpPayload): Promise<IVersionBumpResult>
}

export interface IDesktopFilesystemBridge {
    read<T = unknown>(subdir: string, filename: string): Promise<T | null>
    write<T = unknown>(subdir: string, filename: string, data: T): Promise<void>
    delete(subdir: string, filename: string): Promise<void>
    list(subdir: string): Promise<readonly string[]>
}

export interface IDesktopGovernanceBridge {
    evaluatePolicy(payload: IPolicyEvaluatePayload): Promise<IPolicyEvaluateResult>
    getBudget(payload: IBudgetPayload): Promise<IBudgetResult>
    setBudget(payload: ISetBudgetPayload): Promise<void>
    getModelList(workspaceId: string): Promise<IModelListResult>
    allowModel(payload: IModelActionPayload): Promise<void>
    denyModel(payload: IModelActionPayload): Promise<void>
}

export interface IDesktopPluginBridge {
    install(payload: IPluginInstallPayload): Promise<void>
    uninstall(pluginId: string): Promise<void>
    activate(pluginId: string): Promise<void>
    deactivate(pluginId: string): Promise<void>
    list(): Promise<IPluginListResult>
    get(pluginId: string): Promise<IPluginDetailResult | null>
}

export interface IDesktopWorkspaceBridge {
    create(payload: IWorkspaceCreatePayload): Promise<IWorkspaceResult>
    delete(workspaceId: string): Promise<void>
    list(): Promise<IWorkspaceListResult>
    get(workspaceId: string): Promise<IWorkspaceResult | null>
    switch(workspaceId: string): Promise<void>
    getCurrent(): Promise<IWorkspaceResult>
}

export interface IDesktopTestingBridge {
    runScenario(payload: ITestRunPayload): Promise<ITestRunResult>
    runAll(payload: ITestRunAllPayload): Promise<ITestRunResult>
    listScenarios(workspaceId: string): Promise<readonly { readonly id: string; readonly name: string; readonly agentId: string }[]>
    getResults(workspaceId: string): Promise<ITestRunResult>
}

export interface IDesktopExtendedBridge {
    execution: IDesktopExecutionBridge
    agentBuilder: IDesktopAgentBridge
    skillBuilder: IDesktopSkillBridge
    snapshot: IDesktopSnapshotBridge
    version: IDesktopVersionBridge
    filesystem: IDesktopFilesystemBridge
    governance: IDesktopGovernanceBridge
    plugin: IDesktopPluginBridge
    workspace: IDesktopWorkspaceBridge
    testing: IDesktopTestingBridge
}

declare global {
    interface Window {
        agenthubDesktop?: IDesktopExtendedBridge
    }
}
