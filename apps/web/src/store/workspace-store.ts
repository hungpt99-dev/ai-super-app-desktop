/**
 * workspace-store.ts
 * State for workspaces and their execution run history.
 */

import { create } from 'zustand'
import { workspacesApi, type IWorkspace, type IWorkspaceRun } from '../lib/api-client.js'

interface IWorkspaceStore {
  workspaces: IWorkspace[]
  runs: Record<string, IWorkspaceRun[]> // workspaceId → runs
  loading: boolean
  error: string | null

  fetchWorkspaces(): Promise<void>
  createWorkspace(name: string, appId?: string): Promise<IWorkspace>
  updateWorkspace(id: string, name: string): Promise<void>
  deleteWorkspace(id: string): Promise<void>
  fetchRuns(workspaceId: string, limit?: number): Promise<void>
  saveRun(
    workspaceId: string,
    input: string,
    output: string,
    tokensUsed: number,
    model: string,
  ): Promise<IWorkspaceRun>
  clearError(): void
}

export const useWorkspaceStore = create<IWorkspaceStore>((set, get) => ({
  workspaces: [],
  runs: {},
  loading: false,
  error: null,

  fetchWorkspaces: async () => {
    set({ loading: true, error: null })
    try {
      const workspaces = await workspacesApi.list()
      set({ workspaces, loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  createWorkspace: async (name, appId) => {
    const ws = await workspacesApi.create(name, appId)
    set((s) => ({ workspaces: [ws, ...s.workspaces] }))
    return ws
  },

  updateWorkspace: async (id, name) => {
    const updated = await workspacesApi.update(id, name)
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? updated : w)),
    }))
  },

  deleteWorkspace: async (id) => {
    await workspacesApi.delete(id)
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      runs: Object.fromEntries(Object.entries(s.runs).filter(([k]) => k !== id)),
    }))
  },

  fetchRuns: async (workspaceId, limit) => {
    const runs = await workspacesApi.getRuns(workspaceId, limit)
    set((s) => ({ runs: { ...s.runs, [workspaceId]: runs } }))
  },

  saveRun: async (workspaceId, input, output, tokensUsed, model) => {
    const run = await workspacesApi.saveRun(workspaceId, input, output, tokensUsed, model)
    set((s) => ({
      runs: {
        ...s.runs,
        [workspaceId]: [run, ...(s.runs[workspaceId] ?? [])],
      },
    }))
    return run
  },

  clearError: () => set({ error: null }),
}))
