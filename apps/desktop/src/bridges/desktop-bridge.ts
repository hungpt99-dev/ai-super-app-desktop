/**
 * Desktop Bridge Implementation — creates the typed IPC bridge for desktop features.
 *
 * This module provides the actual implementation that wraps Tauri invoke/listen
 * calls into the typed IDesktopExtendedBridge interface.
 *
 * No business logic. No core/execution/infrastructure imports.
 */

import type {
    IDesktopExtendedBridge,
    IDesktopExecutionBridge,
    IDesktopAgentBridge,
    IDesktopSkillBridge,
    IDesktopSnapshotBridge,
    IDesktopVersionBridge,
    IDesktopFilesystemBridge,
    IDesktopGovernanceBridge,
    IDesktopPluginBridge,
    IDesktopWorkspaceBridge,
    IDesktopTestingBridge,
    IDesktopPlanningBridge,
    IDesktopActingBridge,
    IDesktopMetricsBridge,
} from './desktop-bridge-types.js'
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
    IIPCRequest,
    IIPCResponse,
    IPolicyEvaluatePayload,
    IPolicyEvaluateResult,
    IBudgetPayload,
    IBudgetResult,
    ISetBudgetPayload,
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
    IPlanningCreatePayload,
    IPlanningCreateResult,
    IPlanningMicroPayload,
    IPlanningMicroResult,
    IActingExecuteStepPayload,
    IActingExecuteStepResult,
    IActingExecuteMicroPayload,
    IActingExecuteMicroResult,
} from '@agenthub/contracts'

async function ipcInvoke<TPayload, TResult>(channel: string, payload: TPayload): Promise<TResult> {
    const request: IIPCRequest<TPayload> = {
        channel: channel as any,
        requestId: crypto.randomUUID(),
        payload,
        timestamp: new Date().toISOString(),
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core')
        const response = await invoke<IIPCResponse<TResult>>('handle_ipc', { request: JSON.stringify(request) })
        if (!response.success) {
            throw new Error(response.error?.message ?? 'IPC call failed')
        }
        return response.data as TResult
    } catch {
        // Fallback for development without Tauri
        const { handleIPCMessage } = await import('../main/ipc/handler.js')
        const response = await handleIPCMessage(request as any)
        if (!response.success) {
            throw new Error(response.error?.message ?? 'IPC call failed')
        }
        return response.data as TResult
    }
}

function createExecutionBridge(): IDesktopExecutionBridge {
    const listeners = new Set<(event: ExecutionStreamEvent) => void>()

    return {
        async start(payload: IExecutionStartPayload): Promise<IExecutionStartResult> {
            return ipcInvoke('execution:start', payload)
        },
        async stop(payload: IExecutionStopPayload): Promise<void> {
            await ipcInvoke('execution:stop', payload)
        },
        async replay(payload: IReplayRequestDTO): Promise<IReplayResultDTO> {
            return ipcInvoke('execution:replay', payload)
        },
        async getState(executionId: string): Promise<IExecutionStateResult> {
            return ipcInvoke('execution:state', executionId)
        },
        onEvent(handler: (event: ExecutionStreamEvent) => void): () => void {
            listeners.add(handler)

            let unlistenTauri: (() => void) | null = null
            void (async () => {
                try {
                    const { listen } = await import('@tauri-apps/api/event')
                    const unlisten = await listen<ExecutionStreamEvent>('execution:event', (e) => {
                        handler(e.payload)
                    })
                    unlistenTauri = unlisten
                } catch {
                    // Not in Tauri environment
                }
            })()

            return () => {
                listeners.delete(handler)
                unlistenTauri?.()
            }
        },
    }
}

function createAgentBridge(): IDesktopAgentBridge {
    return {
        async save(payload: IAgentSavePayload): Promise<IAgentSaveResult> {
            return ipcInvoke('agent:save', payload)
        },
        async load(agentId: string): Promise<IAgentLoadResult | null> {
            return ipcInvoke('agent:load', agentId)
        },
        async delete(agentId: string): Promise<void> {
            await ipcInvoke('agent:delete', agentId)
        },
        async listLocal(): Promise<readonly ILocalAgentListItem[]> {
            return ipcInvoke('agent:list-local', null)
        },
        async validate(agent: IAgentDefinitionDTO): Promise<IValidationResultDTO> {
            return ipcInvoke('agent:validate', agent)
        },
    }
}

function createSkillBridge(): IDesktopSkillBridge {
    return {
        async save(payload: ISkillSavePayload): Promise<ISkillSaveResult> {
            return ipcInvoke('skill:save', payload)
        },
        async load(skillId: string): Promise<ISkillLoadResult | null> {
            return ipcInvoke('skill:load', skillId)
        },
        async delete(skillId: string): Promise<void> {
            await ipcInvoke('skill:delete', skillId)
        },
        async listLocal(): Promise<readonly ILocalSkillListItem[]> {
            return ipcInvoke('skill:list-local', null)
        },
        async validate(skill: ISkillDefinitionDTO): Promise<IValidationResultDTO> {
            return ipcInvoke('skill:validate', skill)
        },
    }
}

function createSnapshotBridge(): IDesktopSnapshotBridge {
    return {
        async list(): Promise<readonly ISnapshotSummaryDTO[]> {
            return ipcInvoke('snapshot:list', null)
        },
        async load(executionId: string): Promise<ISnapshotDTO | null> {
            return ipcInvoke('snapshot:load', executionId)
        },
        async delete(executionId: string): Promise<void> {
            await ipcInvoke('snapshot:delete', executionId)
        },
        async replay(payload: IReplayRequestDTO): Promise<IReplayResultDTO> {
            return ipcInvoke('snapshot:replay', payload)
        },
    }
}

function createVersionBridge(): IDesktopVersionBridge {
    return {
        async getHistory(entityId: string): Promise<IVersionHistoryDTO | null> {
            return ipcInvoke('version:history', entityId)
        },
        async bump(payload: IVersionBumpPayload): Promise<IVersionBumpResult> {
            return ipcInvoke('version:bump', payload)
        },
    }
}

function createFilesystemBridge(): IDesktopFilesystemBridge {
    return {
        async read<T = unknown>(subdir: string, filename: string): Promise<T | null> {
            return ipcInvoke('filesystem:read', { subdir, filename })
        },
        async write<T = unknown>(subdir: string, filename: string, data: T): Promise<void> {
            await ipcInvoke('filesystem:write', { subdir, filename, data })
        },
        async delete(subdir: string, filename: string): Promise<void> {
            await ipcInvoke('filesystem:delete', { subdir, filename })
        },
        async list(subdir: string): Promise<readonly string[]> {
            return ipcInvoke('filesystem:list', { subdir })
        },
    }
}

let _bridge: IDesktopExtendedBridge | null = null

function createGovernanceBridge(): IDesktopGovernanceBridge {
    return {
        async evaluatePolicy(payload: IPolicyEvaluatePayload): Promise<IPolicyEvaluateResult> {
            return ipcInvoke('governance:evaluate-policy', payload)
        },
        async getBudget(payload: IBudgetPayload): Promise<IBudgetResult> {
            return ipcInvoke('governance:get-budget', payload)
        },
        async setBudget(payload: ISetBudgetPayload): Promise<void> {
            await ipcInvoke('governance:set-budget', payload)
        },
        async getModelList(workspaceId: string): Promise<IModelListResult> {
            return ipcInvoke('governance:list-models', workspaceId)
        },
        async allowModel(payload: IModelActionPayload): Promise<void> {
            await ipcInvoke('governance:allow-model', payload)
        },
        async denyModel(payload: IModelActionPayload): Promise<void> {
            await ipcInvoke('governance:deny-model', payload)
        },
    }
}

function createPluginBridge(): IDesktopPluginBridge {
    return {
        async install(payload: IPluginInstallPayload): Promise<void> {
            await ipcInvoke('plugin:install', payload)
        },
        async uninstall(pluginId: string): Promise<void> {
            await ipcInvoke('plugin:uninstall', pluginId)
        },
        async activate(pluginId: string): Promise<void> {
            await ipcInvoke('plugin:activate', pluginId)
        },
        async deactivate(pluginId: string): Promise<void> {
            await ipcInvoke('plugin:deactivate', pluginId)
        },
        async list(): Promise<IPluginListResult> {
            return ipcInvoke('plugin:list', null)
        },
        async get(pluginId: string): Promise<IPluginDetailResult | null> {
            return ipcInvoke('plugin:get', pluginId)
        },
    }
}

function createWorkspaceBridge(): IDesktopWorkspaceBridge {
    return {
        async initialize(): Promise<unknown> {
            return ipcInvoke('workspace:initialize', {})
        },
        async create(payload: { name: string }): Promise<unknown> {
            return ipcInvoke('workspace:create', payload)
        },
        async delete(payload: { workspaceId: string }): Promise<void> {
            return ipcInvoke('workspace:delete', payload)
        },
        async rename(payload: { workspaceId: string; newName: string }): Promise<unknown> {
            return ipcInvoke('workspace:rename', payload)
        },
        async switch(payload: { workspaceId: string }): Promise<unknown> {
            return ipcInvoke('workspace:switch', payload)
        },
        async list(): Promise<unknown> {
            return ipcInvoke('workspace:list', {})
        },
        async getActive(): Promise<unknown> {
            return ipcInvoke('workspace:getActive', {})
        },
        async duplicate(payload: { sourceWorkspaceId: string; newName: string }): Promise<unknown> {
            return ipcInvoke('workspace:duplicate', payload)
        },
    }
}

function createTestingBridge(): IDesktopTestingBridge {
    return {
        async runScenario(payload: ITestRunPayload): Promise<ITestRunResult> {
            return ipcInvoke('test:run-scenario', payload)
        },
        async runAll(payload: ITestRunAllPayload): Promise<ITestRunResult> {
            return ipcInvoke('test:run-all', payload)
        },
        async listScenarios(workspaceId: string): Promise<readonly { readonly id: string; readonly name: string; readonly agentId: string }[]> {
            return ipcInvoke('test:list-scenarios', workspaceId)
        },
        async getResults(workspaceId: string): Promise<ITestRunResult> {
            return ipcInvoke('test:get-results', workspaceId)
        },
    }
}

function createPlanningBridge(): IDesktopPlanningBridge {
    return {
        async create(payload: IPlanningCreatePayload): Promise<IPlanningCreateResult> {
            return ipcInvoke('planning:create', payload)
        },
        async micro(payload: IPlanningMicroPayload): Promise<IPlanningMicroResult> {
            return ipcInvoke('planning:micro', payload)
        },
    }
}

function createActingBridge(): IDesktopActingBridge {
    return {
        async executeStep(payload: IActingExecuteStepPayload): Promise<IActingExecuteStepResult> {
            return ipcInvoke('acting:executeStep', payload)
        },
        async executeMicro(payload: IActingExecuteMicroPayload): Promise<IActingExecuteMicroResult> {
            return ipcInvoke('acting:executeMicro', payload)
        },
    }
}

function createMetricsBridge(): IDesktopMetricsBridge {
    return {
        async getExecutionSummary(payload: { executionId: string }): Promise<unknown> {
            return ipcInvoke('metrics:getExecutionSummary', payload)
        },
        async getDailyUsage(payload: { date: string }): Promise<unknown> {
            return ipcInvoke('metrics:getDailyUsage', payload)
        },
        async getAgentBreakdown(payload: { date: string }): Promise<unknown> {
            return ipcInvoke('metrics:getAgentBreakdown', payload)
        },
        async getAllExecutions(): Promise<readonly string[]> {
            return ipcInvoke('metrics:getAllExecutions', null)
        },
        async exportReport(payload: { fromDate: string; toDate: string }): Promise<unknown> {
            return ipcInvoke('metrics:exportReport', payload)
        },
        async getSummary(payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> {
            return ipcInvoke('metrics:getSummary', payload)
        },
        async getTokens(payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> {
            return ipcInvoke('metrics:getTokens', payload)
        },
        async getCosts(payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> {
            return ipcInvoke('metrics:getCosts', payload)
        },
        async getAgents(payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> {
            return ipcInvoke('metrics:getAgents', payload)
        },
        async getExecutions(payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> {
            return ipcInvoke('metrics:getExecutions', payload)
        },
        async getTools(payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> {
            return ipcInvoke('metrics:getTools', payload)
        },
        async getModels(payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> {
            return ipcInvoke('metrics:getModels', payload)
        },
        async exportData(payload: { fromDate: string; toDate: string }): Promise<unknown> {
            return ipcInvoke('metrics:export', payload)
        },
    }
}

export function getDesktopExtendedBridge(): IDesktopExtendedBridge {
    if (_bridge) return _bridge

    _bridge = {
        execution: createExecutionBridge(),
        agentBuilder: createAgentBridge(),
        skillBuilder: createSkillBridge(),
        snapshot: createSnapshotBridge(),
        version: createVersionBridge(),
        filesystem: createFilesystemBridge(),
        governance: createGovernanceBridge(),
        plugin: createPluginBridge(),
        workspace: createWorkspaceBridge(),
        testing: createTestingBridge(),
        planning: createPlanningBridge(),
        acting: createActingBridge(),
        metrics: createMetricsBridge(),
    }

    if (typeof window !== 'undefined') {
        window.agenthubDesktop = _bridge
    }

    return _bridge
}
