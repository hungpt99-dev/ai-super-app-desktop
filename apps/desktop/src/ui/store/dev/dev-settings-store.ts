import { create } from 'zustand'

const STORAGE_KEY = 'agenthub-dev-settings'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** All developer / advanced settings — persisted to localStorage. */
export interface IDevSettings {
  /** Master switch — when false, none of the other settings take effect. */
  enabled: boolean
  /** Override the cloud gateway base URL (empty = compile-time default). */
  gatewayUrlOverride: string
  /** Minimum log level written to the Logs panel. */
  logLevel: LogLevel
  /** Log full request and response bodies for every outbound HTTP call. */
  verboseRequests: boolean
  /** Surface module sandbox exceptions in the chat UI instead of swallowing them. */
  showSandboxErrors: boolean
  /** ⚠ Dangerous — bypasses the permission engine for all module tool calls. */
  disableSandbox: boolean
  /** Return synthetic stub responses without calling any AI provider. */
  mockAiResponses: boolean
  /** Enable features guarded by the experimental flag. */
  experimentalFeatures: boolean
  /** Render a floating FPS + memory metrics overlay. */
  showPerformanceMetrics: boolean
}

interface IDevSettingsActions {
  setEnabled: (v: boolean) => void
  /** Update a single setting key. */
  setSetting: <K extends keyof IDevSettings>(key: K, value: IDevSettings[K]) => void
  /** Reset all settings to their defaults. */
  reset: () => void
}

const DEFAULTS: IDevSettings = {
  enabled: false,
  gatewayUrlOverride: '',
  logLevel: 'info',
  verboseRequests: false,
  showSandboxErrors: true,
  disableSandbox: false,
  mockAiResponses: false,
  experimentalFeatures: false,
  showPerformanceMetrics: false,
}

function readPersisted(): IDevSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<IDevSettings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

function persistSettings(s: IDevSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch { /* ignore in non-browser contexts */ }
}

/** Zustand store for developer / advanced settings. Persisted to localStorage. */
export const useDevSettingsStore = create<IDevSettings & IDevSettingsActions>((set, get) => ({
  ...readPersisted(),

  setEnabled: (v) => {
    const next = { ...get(), enabled: v }
    persistSettings(next)
    set({ enabled: v })
  },

  setSetting: (key, value) => {
    const next = { ...get(), [key]: value } as IDevSettings
    persistSettings(next)
    set({ [key]: value } as Partial<IDevSettings & IDevSettingsActions>)
  },

  reset: () => {
    persistSettings(DEFAULTS)
    set(DEFAULTS)
  },
}))
