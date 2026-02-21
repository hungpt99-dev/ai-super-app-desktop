/**
 * device-store.ts
 * State for registered Desktop Agent devices.
 */

import { create } from 'zustand'
import { devicesApi, type IDevice } from '../lib/api-client.js'

interface IDeviceStore {
  devices: IDevice[]
  loading: boolean
  error: string | null

  fetchDevices: () => Promise<void>
  registerDevice: (name: string, platform: string, version: string) => Promise<IDevice>
  renameDevice: (id: string, name: string) => Promise<void>
  removeDevice: (id: string) => Promise<void>
  clearError: () => void
}

export const useDeviceStore = create<IDeviceStore>((set) => ({
  devices: [],
  loading: false,
  error: null,

  fetchDevices: async () => {
    set({ loading: true, error: null })
    try {
      const devices = await devicesApi.list()
      set({ devices, loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  registerDevice: async (name, platform, version) => {
    const device = await devicesApi.register(name, platform, version)
    set((s) => ({ devices: [device, ...s.devices] }))
    return device
  },

  renameDevice: async (id, name) => {
    const updated = await devicesApi.rename(id, name)
    set((s) => ({ devices: s.devices.map((d) => (d.id === id ? updated : d)) }))
  },

  removeDevice: async (id) => {
    await devicesApi.remove(id)
    set((s) => ({ devices: s.devices.filter((d) => d.id !== id) }))
  },

  clearError: () => { set({ error: null }) },
}))

// Expose fetchDevices for caller convenience.
export function useOnlineCount(): number {
  const { devices } = useDeviceStore()
  return devices.filter((d) => d.status === 'online').length
}
