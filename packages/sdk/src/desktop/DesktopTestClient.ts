/**
 * DesktopTestClient — SDK layer for test execution.
 *
 * Wraps IPC calls to the main process.
 * Must not instantiate runtime.
 * Must not import execution or core.
 *
 * Renderer imports this via @agenthub/sdk.
 */

import type {
    ITestRunPayload,
    ITestRunAllPayload,
    ITestRunResult,
} from '@agenthub/contracts'

export interface IDesktopTestClient {
    runScenario(payload: ITestRunPayload): Promise<ITestRunResult>
    runAll(payload: ITestRunAllPayload): Promise<ITestRunResult>
    listScenarios(workspaceId: string): Promise<readonly { readonly id: string; readonly name: string; readonly agentId: string }[]>
    getResults(workspaceId: string): Promise<ITestRunResult>
}

export class DesktopTestClient implements IDesktopTestClient {
    private getBridge(): NonNullable<typeof window.agenthubDesktop> {
        if (!window.agenthubDesktop) {
            throw new Error('Desktop bridge not initialized. Ensure getDesktopExtendedBridge() was called.')
        }
        return window.agenthubDesktop
    }

    async runScenario(payload: ITestRunPayload): Promise<ITestRunResult> {
        return (this.getBridge() as any).testing.runScenario(payload)
    }

    async runAll(payload: ITestRunAllPayload): Promise<ITestRunResult> {
        return (this.getBridge() as any).testing.runAll(payload)
    }

    async listScenarios(workspaceId: string): Promise<readonly { readonly id: string; readonly name: string; readonly agentId: string }[]> {
        return (this.getBridge() as any).testing.listScenarios(workspaceId)
    }

    async getResults(workspaceId: string): Promise<ITestRunResult> {
        return (this.getBridge() as any).testing.getResults(workspaceId)
    }
}
