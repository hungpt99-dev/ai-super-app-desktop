/**
 * IPC Handler — typed message router for main ↔ renderer communication.
 *
 * All IPC calls from the renderer arrive here. The handler dispatches
 * to the appropriate RuntimeHost or PlatformHost method and returns
 * a typed IIPCResponse.
 *
 * The renderer NEVER imports core, execution, or infrastructure directly.
 * It sends IPC messages using @agenthub/contracts types.
 *
 * See: docs/technical-design.md §14 IPC ARCHITECTURE
 */

import type {
    IIPCRequest,
    IIPCResponse,
    IPCChannel,
    IModuleInvokePayload,
    IRuntimeStatusPayload,
    DesktopIPCChannel,
    IExecutionStartPayload,
    IExecutionStopPayload,
    IAgentSavePayload,
    ISkillSavePayload,
    IReplayRequestDTO,
    IAgentDefinitionDTO,
    ISkillDefinitionDTO,
    IVersionBumpPayload,
    IPlanningCreatePayload,
    IPlanningMicroPayload,
    IActingExecuteStepPayload,
    IActingExecuteMicroPayload,
} from '@agenthub/contracts'
import { runtimeHost } from '../runtime-host.js'
import { platformHost } from '../platform-host.js'
import { executionIPC } from './execution.ipc.js'
import { agentIPC } from './agent.ipc.js'
import { skillIPC } from './skill.ipc.js'
import { snapshotIPC } from './snapshot.ipc.js'
import { filesystemIPC } from './filesystem.ipc.js'
import { planningIPC } from './planning.ipc.js'
import { actingIPC } from './acting.ipc.js'
import { metricsIPC } from './metrics.ipc.js'
import { workspaceIPC } from './workspace.ipc.js'
import { workspaceTabsIPC } from './workspace-tabs.ipc.js'
import type {
    IFilesystemReadPayload,
    IFilesystemWritePayload,
    IFilesystemDeletePayload,
    IFilesystemListPayload,
} from './filesystem.ipc.js'
import { logger } from '@agenthub/shared'
import { ipcSecurity } from '../security/ipc-security.js'

const log = logger.child('IPCHandler')

export async function handleIPCMessage(request: IIPCRequest): Promise<IIPCResponse> {
    const { channel, requestId, payload } = request

    try {
        // Security validation - fail closed
        const workspaceId = (payload as { workspaceId?: string })?.workspaceId ?? null
        const permissions = (payload as { permissions?: string[] })?.permissions ?? []
        const validation = ipcSecurity.validateRequest(channel, workspaceId, null, permissions)
        
        if (!validation.valid) {
            log.warn('IPC request rejected by security middleware', { channel, workspaceId, reason: validation.error })
            return {
                channel,
                requestId,
                success: false,
                error: {
                    code: 'SECURITY_ERROR',
                    message: validation.error || 'Request rejected',
                },
                timestamp: new Date().toISOString(),
            }
        }

        const data = await dispatch(channel, payload)
        return {
            channel,
            requestId,
            success: true,
            data,
            timestamp: new Date().toISOString(),
        }
    } catch (err) {
        log.error(`IPC error on channel ${channel}`, { error: String(err) })
        return {
            channel,
            requestId,
            success: false,
            error: {
                code: 'IPC_ERROR',
                message: err instanceof Error ? err.message : String(err),
            },
            timestamp: new Date().toISOString(),
        }
    }
}

async function dispatch(channel: IPCChannel | DesktopIPCChannel, payload: unknown): Promise<unknown> {
    switch (channel) {
        case 'runtime:init':
            return runtimeHost.start()

        case 'runtime:status': {
            const status: IRuntimeStatusPayload = {
                initialized: platformHost.isInitialized,
                agentCount: 0,
                moduleCount: runtimeHost.getBuiltinModules().length,
                uptime: 0,
            }
            return status
        }

        case 'module:list':
            return runtimeHost.getBuiltinModules().map(m => ({
                id: m.id,
                name: m.definition.manifest.name,
                version: m.definition.manifest.version,
                description: m.definition.manifest.description,
            }))

        case 'module:invoke-tool': {
            const p = payload as IModuleInvokePayload
            log.info('Module tool invocation via IPC', { moduleId: p.moduleId, tool: p.toolName })
            return { invoked: true, moduleId: p.moduleId, tool: p.toolName }
        }

        case 'agent:list':
            return []

        case 'agent:start':
            await runtimeHost.startAgentLoop()
            return { started: true }

        case 'agent:stop':
            runtimeHost.stopAgentLoop()
            return { stopped: true }

        // ── Desktop-specific channels ──────────────────────────────────

        case 'execution:start':
            return executionIPC.start(payload as IExecutionStartPayload)

        case 'execution:stop':
            return executionIPC.stop(payload as IExecutionStopPayload)

        case 'execution:replay':
            return executionIPC.replay(payload as IReplayRequestDTO)

        case 'execution:state':
            return executionIPC.getState(payload as string)

        case 'agent:save':
            return agentIPC.save(payload as IAgentSavePayload)

        case 'agent:load':
            return agentIPC.load(payload as string)

        case 'agent:delete':
            return agentIPC.delete(payload as string)

        case 'agent:list-local':
            return agentIPC.listLocal()

        case 'agent:validate':
            return agentIPC.validate(payload as IAgentDefinitionDTO)

        case 'skill:save':
            return skillIPC.save(payload as ISkillSavePayload)

        case 'skill:load':
            return skillIPC.load(payload as string)

        case 'skill:delete':
            return skillIPC.delete(payload as string)

        case 'skill:list-local':
            return skillIPC.listLocal()

        case 'skill:validate':
            return skillIPC.validate(payload as ISkillDefinitionDTO)

        case 'snapshot:list':
            return snapshotIPC.list()

        case 'snapshot:load':
            return snapshotIPC.load(payload as string)

        case 'snapshot:delete':
            return snapshotIPC.delete(payload as string)

        case 'snapshot:replay':
            return snapshotIPC.replay(payload as IReplayRequestDTO)

        case 'version:history':
            return null

        case 'version:bump':
            return null

        case 'filesystem:read':
            return filesystemIPC.read(payload as IFilesystemReadPayload)

        case 'filesystem:write':
            return filesystemIPC.write(payload as IFilesystemWritePayload)

        case 'filesystem:delete':
            return filesystemIPC.delete(payload as IFilesystemDeletePayload)

        case 'filesystem:list':
            return filesystemIPC.list(payload as IFilesystemListPayload)

        // ── Planning channels ──────────────────────────────────────────

        case 'planning:create':
            return planningIPC.create(payload as IPlanningCreatePayload)

        case 'planning:micro':
            return planningIPC.micro(payload as IPlanningMicroPayload)

        // ── Acting channels ────────────────────────────────────────────

        case 'acting:executeStep':
            return actingIPC.executeStep(payload as IActingExecuteStepPayload)

        case 'acting:executeMicro':
            return actingIPC.executeMicro(payload as IActingExecuteMicroPayload)

        // ── Metrics channels ──────────────────────────────────────────────

        case 'metrics:getExecutionSummary':
            return metricsIPC.getExecutionSummary(payload as any)

        case 'metrics:getDailyUsage':
            return metricsIPC.getDailyUsage(payload as any)

        case 'metrics:getAgentBreakdown':
            return metricsIPC.getAgentBreakdown(payload as any)

        case 'metrics:getAllExecutions':
            return metricsIPC.getAllExecutions()

        case 'metrics:exportReport':
            return metricsIPC.exportReport(payload as any)

        case 'metrics:getSummary':
            return metricsIPC.getSummary(payload as any)

        case 'metrics:getTokens':
            return metricsIPC.getTokens(payload as any)

        case 'metrics:getCosts':
            return metricsIPC.getCosts(payload as any)

        case 'metrics:getAgents':
            return metricsIPC.getAgents(payload as any)

        case 'metrics:getExecutions':
            return metricsIPC.getExecutions(payload as any)

        case 'metrics:getTools':
            return metricsIPC.getTools(payload as any)

        case 'metrics:getModels':
            return metricsIPC.getModels(payload as any)

        case 'metrics:export':
            return metricsIPC.exportData(payload as any)

        // ── Workspace channels ────────────────────────────────────────────────

        case 'workspace:initialize':
            return workspaceIPC.initialize()

        case 'workspace:create':
            return workspaceIPC.create(payload as any)

        case 'workspace:delete':
            return workspaceIPC.delete(payload as any)

        case 'workspace:rename':
            return workspaceIPC.rename(payload as any)

        case 'workspace:switch':
            return workspaceIPC.switch(payload as any)

        case 'workspace:list':
            return workspaceIPC.list()

        case 'workspace:getActive':
            return workspaceIPC.getActive()

        case 'workspace:duplicate':
            return workspaceIPC.duplicate(payload as any)

        // ── Workspace Tabs channels ─────────────────────────────────────────────

        case 'workspaceTabs:initialize':
            return workspaceTabsIPC.initialize()

        case 'workspaceTabs:create':
            return workspaceTabsIPC.create((payload as { name: string }).name)

        case 'workspaceTabs:close':
            return workspaceTabsIPC.close(payload as any)

        case 'workspaceTabs:switch':
            return workspaceTabsIPC.switch(payload as any)

        case 'workspaceTabs:rename':
            return workspaceTabsIPC.rename(payload as any)

        case 'workspaceTabs:list':
            return workspaceTabsIPC.list()

        case 'workspaceTabs:getCurrent':
            return workspaceTabsIPC.getCurrent()

        case 'workspaceTabs:addAgent':
            return workspaceTabsIPC.addAgent(payload as any)

        case 'workspaceTabs:removeAgent':
            return workspaceTabsIPC.removeAgent(payload as any)

        case 'workspaceTabs:getAgents':
            return workspaceTabsIPC.getAgents(payload as any)

        default:
            throw new Error(`Unknown IPC channel: ${channel}`)
    }
}
