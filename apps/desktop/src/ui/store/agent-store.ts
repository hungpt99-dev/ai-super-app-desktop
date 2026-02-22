/**
 * agent-store.ts
 *
 * Live state for the Desktop AI Worker / Agent.
 * Tracks device registration, the active agent run, and simulated system metrics.
 */

import { create } from 'zustand'

/** Simulated system metrics shown in the desktop status bar. */
export interface IAgentMetrics {
  cpuPercent: number
  memPercent: number
  tasksCompleted: number
  uptimeSeconds: number
}

interface IAgentState {
  /** Backend device ID (null until registration succeeds). */
  deviceId: string | null
  /** Human-readable device name assigned at registration. */
  deviceName: string | null
  /** Current worker status. */
  status: 'offline' | 'idle' | 'running' | 'paused'
  /** ID of the agent run currently being executed (null when idle). */
  activeRunId: string | null
  /** Goal/description of the agent run currently being executed (null when idle). */
  activeRunGoal: string | null
  /** Simulated live system metrics. */
  metrics: IAgentMetrics

  setDevice(id: string, name: string): void
  setStatus(status: IAgentState['status']): void
  /** Set the active run ID and its goal text together. */
  setActiveRun(runId: string | null, goal?: string | null): void
  updateMetrics(patch: Partial<IAgentMetrics>): void
  incrementCompleted(): void
}

export const useAgentStore = create<IAgentState>((set) => ({
  deviceId: null,
  deviceName: null,
  status: 'offline',
  activeRunId: null,
  activeRunGoal: null,
  metrics: { cpuPercent: 0, memPercent: 0, tasksCompleted: 0, uptimeSeconds: 0 },

  setDevice: (id, name) => { set({ deviceId: id, deviceName: name }) },
  setStatus: (status) => { set({ status }) },
  setActiveRun: (runId, goal = null) => { set({ activeRunId: runId, activeRunGoal: runId === null ? null : (goal ?? null) }) },
  updateMetrics: (patch) => {
    set((s) => ({ metrics: { ...s.metrics, ...patch } }))
  },
  incrementCompleted: () => {
    set((s) => ({
      metrics: { ...s.metrics, tasksCompleted: s.metrics.tasksCompleted + 1 },
    }))
  },
}))
