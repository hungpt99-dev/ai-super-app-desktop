/**
 * DesktopMetricsTransport — Tauri invoke-based transport for MetricsClient.
 *
 * Implements IMetricsTransport using Tauri invocations.
 * SDK clients should never call Tauri directly.
 */

import type { IMetricsTransport } from '../client/MetricsClient.js'

export interface IDesktopMetricsClient {
    getExecutionSummary(executionId: string): Promise<unknown>
    getDailyUsage(date: string): Promise<unknown>
    getAgentBreakdown(date: string): Promise<unknown>
    getAllExecutions(): Promise<readonly string[]>
    exportReport(fromDate: string, toDate: string): Promise<unknown>
}

export class DesktopMetricsTransport implements IMetricsTransport {
    private getBridge(): NonNullable<typeof window.agenthubDesktop> {
        if (!window.agenthubDesktop) {
            throw new Error('Desktop bridge not initialized. Ensure getDesktopExtendedBridge() was called.')
        }
        return window.agenthubDesktop
    }

    async invoke<T>(channel: string, payload?: unknown): Promise<T> {
        const bridge = this.getBridge() as any
        switch (channel) {
            case 'metrics:getExecutionSummary':
                return bridge.metrics.getExecutionSummary(payload) as T
            case 'metrics:getDailyUsage':
                return bridge.metrics.getDailyUsage(payload) as T
            case 'metrics:getAgentBreakdown':
                return bridge.metrics.getAgentBreakdown(payload) as T
            case 'metrics:getAllExecutions':
                return bridge.metrics.getAllExecutions() as T
            case 'metrics:exportReport':
                return bridge.metrics.exportReport(payload) as T
            default:
                throw new Error(`Unknown metrics channel: ${channel}`)
        }
    }
}

export class DesktopMetricsClient implements IDesktopMetricsClient {
    private readonly transport = new DesktopMetricsTransport()

    async getExecutionSummary(executionId: string): Promise<unknown> {
        return this.transport.invoke('metrics:getExecutionSummary', { executionId })
    }

    async getDailyUsage(date: string): Promise<unknown> {
        return this.transport.invoke('metrics:getDailyUsage', { date })
    }

    async getAgentBreakdown(date: string): Promise<unknown> {
        return this.transport.invoke('metrics:getAgentBreakdown', { date })
    }

    async getAllExecutions(): Promise<readonly string[]> {
        return this.transport.invoke<readonly string[]>('metrics:getAllExecutions')
    }

    async exportReport(fromDate: string, toDate: string): Promise<unknown> {
        return this.transport.invoke('metrics:exportReport', { fromDate, toDate })
    }
}
