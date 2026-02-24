/**
 * DesktopGovernanceClient — SDK layer for governance operations.
 *
 * Wraps IPC calls to the main process.
 * Must not instantiate runtime.
 * Must not import execution or core.
 *
 * Renderer imports this via @agenthub/sdk.
 */

import type {
    IPolicyEvaluatePayload,
    IPolicyEvaluateResult,
    IBudgetPayload,
    IBudgetResult,
    ISetBudgetPayload,
    IRateLimitPayload,
    ISetRateLimitPayload,
    IModelListResult,
    IModelActionPayload,
} from '@agenthub/contracts'

export interface IDesktopGovernanceClient {
    evaluatePolicy(payload: IPolicyEvaluatePayload): Promise<IPolicyEvaluateResult>
    getBudget(payload: IBudgetPayload): Promise<IBudgetResult>
    setBudget(payload: ISetBudgetPayload): Promise<void>
    getModelList(workspaceId: string): Promise<IModelListResult>
    allowModel(payload: IModelActionPayload): Promise<void>
    denyModel(payload: IModelActionPayload): Promise<void>
}

export class DesktopGovernanceClient implements IDesktopGovernanceClient {
    private getBridge(): NonNullable<typeof window.agenthubDesktop> {
        if (!window.agenthubDesktop) {
            throw new Error('Desktop bridge not initialized. Ensure getDesktopExtendedBridge() was called.')
        }
        return window.agenthubDesktop
    }

    async evaluatePolicy(payload: IPolicyEvaluatePayload): Promise<IPolicyEvaluateResult> {
        return (this.getBridge() as any).governance.evaluatePolicy(payload)
    }

    async getBudget(payload: IBudgetPayload): Promise<IBudgetResult> {
        return (this.getBridge() as any).governance.getBudget(payload)
    }

    async setBudget(payload: ISetBudgetPayload): Promise<void> {
        return (this.getBridge() as any).governance.setBudget(payload)
    }

    async getModelList(workspaceId: string): Promise<IModelListResult> {
        return (this.getBridge() as any).governance.getModelList(workspaceId)
    }

    async allowModel(payload: IModelActionPayload): Promise<void> {
        return (this.getBridge() as any).governance.allowModel(payload)
    }

    async denyModel(payload: IModelActionPayload): Promise<void> {
        return (this.getBridge() as any).governance.denyModel(payload)
    }
}
