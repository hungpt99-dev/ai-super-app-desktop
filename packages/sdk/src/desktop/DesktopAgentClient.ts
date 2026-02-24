/**
 * DesktopAgentClient — SDK layer for agent builder/library.
 *
 * Wraps IPC calls to the main process.
 * Must not instantiate runtime.
 * Must not import execution or core.
 *
 * Renderer imports this via @agenthub/sdk.
 */

import type {
    IAgentDefinitionDTO,
    IAgentSavePayload,
    IAgentSaveResult,
    IAgentLoadResult,
    ILocalAgentListItem,
    IValidationResultDTO,
} from '@agenthub/contracts'

export interface IDesktopAgentClient {
    saveAgent(agent: IAgentDefinitionDTO, bump?: 'patch' | 'minor' | 'major'): Promise<IAgentSaveResult>
    loadAgent(agentId: string): Promise<IAgentLoadResult | null>
    deleteAgent(agentId: string): Promise<void>
    listLocalAgents(): Promise<readonly ILocalAgentListItem[]>
    validateAgent(agent: IAgentDefinitionDTO): Promise<IValidationResultDTO>
}

export class DesktopAgentClient implements IDesktopAgentClient {
    private getBridge(): NonNullable<typeof window.agenthubDesktop> {
        if (!window.agenthubDesktop) {
            throw new Error('Desktop bridge not initialized. Ensure getDesktopExtendedBridge() was called.')
        }
        return window.agenthubDesktop
    }

    async saveAgent(agent: IAgentDefinitionDTO, bump?: 'patch' | 'minor' | 'major'): Promise<IAgentSaveResult> {
        const payload: IAgentSavePayload = { agent, bump }
        return this.getBridge().agentBuilder.save(payload)
    }

    async loadAgent(agentId: string): Promise<IAgentLoadResult | null> {
        return this.getBridge().agentBuilder.load(agentId)
    }

    async deleteAgent(agentId: string): Promise<void> {
        return this.getBridge().agentBuilder.delete(agentId)
    }

    async listLocalAgents(): Promise<readonly ILocalAgentListItem[]> {
        return this.getBridge().agentBuilder.listLocal()
    }

    async validateAgent(agent: IAgentDefinitionDTO): Promise<IValidationResultDTO> {
        return this.getBridge().agentBuilder.validate(agent)
    }
}
