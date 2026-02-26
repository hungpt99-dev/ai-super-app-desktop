import type { IDesktopBridge, IAiRequestOptions, IToastNotification, IAgentPollResult, IAgentRunUpdate } from '../../bridges/bridge-types.js'
import { getAgentRuntime, getActiveModules } from '../../app/module-bootstrap.js'
import { useDevSettingsStore } from '../store/dev/dev-settings-store.js'
import { logger } from '@agenthub/shared'

/** True when running inside the Tauri WebView runtime. */
import { IS_TAURI } from '../../bridges/runtime.js'

/**
 * Cloud Gateway base URL used by the browser dev bridge only.
 * In Tauri, all HTTP calls are made by Rust commands — this constant is unused.
 */
const DEV_GATEWAY: string = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000'

/**
 * Get developer token from environment or session storage.
 * NEVER hardcode tokens in source code.
 */
function getDevToken(): string {
  // Check environment first
  const envToken = import.meta.env.VITE_DEV_TOKEN
  if (envToken && envToken !== 'dev-token') {
    return envToken
  }
  // Check session storage (set by auth flow)
  try {
    const sessionToken = sessionStorage.getItem('agenthub:dev-token')
    if (sessionToken) {
      return sessionToken
    }
  } catch {
    // SessionStorage not available
  }
  // Return placeholder - actual auth should come from environment or session
  return ''
}

/** Returns the effective gateway base URL, honouring the developer-mode URL override. */
function getGatewayBase(): string {
  try {
    const { enabled, gatewayUrlOverride } = useDevSettingsStore.getState()
    if (enabled && gatewayUrlOverride.trim()) return gatewayUrlOverride.trim()
  } catch { /* store not yet initialized */ }
  return DEV_GATEWAY
}

const sharedModules = {
  list: (): Promise<{ id: string; name: string; version: string }[]> => {
    const builtins = getActiveModules()
    return Promise.resolve(
      builtins.map((m) => ({
        id: m.id,
        name: m.definition.manifest.name,
        version: m.definition.manifest.version,
      }))
    )
  },

  install: (): Promise<void> => Promise.resolve(),
  uninstall: (): Promise<void> => Promise.resolve(),

  invokeTool: async (moduleId: string, toolName: string, input?: Record<string, unknown>): Promise<unknown> => {
    // Legacy shim for UI components
    const builtins = getActiveModules()
    const m = builtins.find(x => x.id === moduleId)
    if (m && toolName !== 'run') {
      const tool = m.definition.tools.find(t => t.name === toolName)
      if (tool) {
        // Mock context for built-in tools to function
        return tool.run(input ?? {}, {
          http: {
            get: async (url: string, opts: any) => {
              const res = await fetch(url, opts)
              const text = await res.text()
              let data: any
              try { data = JSON.parse(text) } catch { data = null }
              return { ok: res.ok, status: res.status, data, text }
            },
            post: async () => ({ ok: false, status: 500, data: null, text: '' })
          },
          ai: {
            generate: async (req: any) => {
              // Note: Assumes devBridge is available below, or ai logic
              // Just a dummy mock for the shim if needed. The actual AI will fail if devBridge isn't ready.
              return { output: 'Legacy AI shim', tokensUsed: 0 }
            }
          },
          ui: { showDashboard: () => { }, notify: () => { } },
          store: { get: async () => null, set: async () => { }, delete: async () => { }, has: async () => false }
        } as any)
      }
    }

    // New AgentRuntime behavior
    const runtime = getAgentRuntime()
    if (!runtime) return Promise.reject(new Error(`AgentRuntime not initialised — graph ${moduleId} cannot run.`))
    return runtime.execute(moduleId, input ?? {})
  },
}

// ─── Tauri bridge ─────────────────────────────────────────────────────────────
// All IPC goes through Tauri `invoke()`. Streaming is done by listening to
// Tauri events that the Rust backend emits as it reads the SSE response.

/** Lazily imported so tree-shaking removes Tauri deps in browser dev mode. */
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(cmd, args)
}

const tauriBridge: IDesktopBridge = {
  // ── Chat ─────────────────────────────────────────────────────────────────
  chat: {
    send: (message: string, options?: IAiRequestOptions) =>
      invoke<{ output: string }>('chat_send', {
        message,
        ...(options?.apiKey ? { apiKey: options.apiKey } : {}),
        ...(options?.provider ? { provider: options.provider } : {}),
        ...(options?.model ? { model: options.model } : {}),
      }),

    onStream: (handler) => {
      let unlisten: (() => void) | null = null
      void import('@tauri-apps/api/event').then(({ listen }) =>
        listen<string>('chat:stream-chunk', (e) => { handler(e.payload) }),
      ).then((fn) => { unlisten = fn })
      return () => { unlisten?.() }
    },
  },

  // ── Modules ──────────────────────────────────────────────────────────────
  modules: sharedModules,

  // ── AI ───────────────────────────────────────────────────────────────────
  ai: {
    generate: async (capability, input, context, options) => {
      const res = await invoke<{ output: string; tokens_used: number }>(
        'ai_generate',
        {
          capability,
          input,
          ...(context ? { context } : {}),
          ...(options?.apiKey ? { apiKey: options.apiKey } : {}),
          ...(options?.provider ? { provider: options.provider } : {}),
          ...(options?.model ? { model: options.model } : {}),
        },
      )
      return { output: res.output, tokensUsed: res.tokens_used }
    },
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: {
    onPush: (handler) => {
      let unlisten: (() => void) | null = null
      void import('@tauri-apps/api/event').then(({ listen }) =>
        listen<Omit<IToastNotification, 'id'>>('notification:push', (e) => { handler(e.payload) }),
      ).then((fn) => { unlisten = fn })
      return () => { unlisten?.() }
    },
  },

  // ── Health ────────────────────────────────────────────────────────────────
  health: {
    check: () =>
      invoke<{ status: 'ok' | 'degraded' | 'down'; components: Record<string, string>; timestamp: string }>(
        'health_check',
      ),
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    status: async () => {
      const raw = await invoke<{ authenticated: boolean; user_id: string | null; plan: string | null }>('auth_status')
      return {
        authenticated: raw.authenticated,
        ...(raw.user_id != null ? { userId: raw.user_id } : {}),
        ...(raw.plan != null ? { plan: raw.plan } : {}),
      }
    },
    login: (clientId, clientSecret) => invoke('auth_login', { clientId, clientSecret }),
    logout: () => invoke('auth_logout'),
  },

  // ── Usage ─────────────────────────────────────────────────────────────────
  usage: {
    summary: async () => {
      const raw = await invoke<{
        input_tokens?: number
        output_tokens?: number
        window_start_unix?: number
      }>('usage_get')
      return {
        inputTokens: raw.input_tokens ?? 0,
        outputTokens: raw.output_tokens ?? 0,
        windowStartUnix: raw.window_start_unix ?? 0,
      }
    },
  },

  // ── App ───────────────────────────────────────────────────────────────────
  app: {
    version: () => invoke<string>('app_version'),
  },

  // ── Agents ─────────────────────────────────────────────────────────────────
  agents: {
    poll: () => invoke<IAgentPollResult | null>('agents_poll'),
    updateRun: (runId: string, update: IAgentRunUpdate) =>
      invoke<undefined>('agents_update_run', { runId, update }).then(() => undefined),
  },

  // ── Metrics ────────────────────────────────────────────────────────────────
  metrics: {
    getExecutionSummary: (payload: { executionId: string }) =>
      invoke<unknown>('metrics:getExecutionSummary', payload),
    getDailyUsage: (payload: { date: string }) =>
      invoke<unknown>('metrics:getDailyUsage', payload),
    getAgentBreakdown: (payload: { date: string }) =>
      invoke<unknown>('metrics:getAgentBreakdown', payload),
    getAllExecutions: () =>
      invoke<readonly string[]>('metrics:getAllExecutions'),
    exportReport: (payload: { fromDate: string; toDate: string }) =>
      invoke<unknown>('metrics:exportReport', payload),
    getSummary: (payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }) =>
      invoke<unknown>('metrics:getSummary', payload),
    getTokens: (payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }) =>
      invoke<unknown>('metrics:getTokens', payload),
    getCosts: (payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }) =>
      invoke<unknown>('metrics:getCosts', payload),
    getAgents: (payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }) =>
      invoke<unknown>('metrics:getAgents', payload),
    getExecutions: (payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }) =>
      invoke<unknown>('metrics:getExecutions', payload),
    getTools: (payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }) =>
      invoke<unknown>('metrics:getTools', payload),
    getModels: (payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }) =>
      invoke<unknown>('metrics:getModels', payload),
    exportData: (payload: { fromDate: string; toDate: string }) =>
      invoke<unknown>('metrics:export', payload),
  },

  // ── Workspace ────────────────────────────────────────────────────────────────
  workspace: {
    initialize: (): Promise<unknown> =>
      invoke<unknown>('workspace:initialize'),
    create: (payload: { name: string }): Promise<unknown> =>
      invoke<unknown>('workspace:create', payload),
    delete: (payload: { workspaceId: string }): Promise<void> =>
      invoke('workspace:delete', payload),
    rename: (payload: { workspaceId: string; newName: string }): Promise<unknown> =>
      invoke<unknown>('workspace:rename', payload),
    switch: (payload: { workspaceId: string }): Promise<unknown> =>
      invoke<unknown>('workspace:switch', payload),
    list: (): Promise<unknown> =>
      invoke<unknown>('workspace:list'),
    getActive: (): Promise<unknown> =>
      invoke<unknown>('workspace:getActive'),
    duplicate: (payload: { sourceWorkspaceId: string; newName: string }): Promise<unknown> =>
      invoke<unknown>('workspace:duplicate', payload),
  },

  // ── Workspace Tabs ─────────────────────────────────────────────────────────────
  workspaceTabs: (() => {
    const STORAGE_KEY = 'dev-workspace-tabs'
    const AGENTS_STORAGE_KEY = 'dev-workspace-agents'
    const LOG_PREFIX = '[WorkspaceTabs]'

    // In-memory cache to reduce localStorage reads
    let tabsCache: Array<{ id: string; name: string; isDefault: boolean; createdAt: number; closedAt: number | null }> | null = null
    let agentsCache: Record<string, string[]> | null = null
    let cacheDirty = false

    // Use proper logger for security and production quality
    const workspaceLog = logger.child('WorkspaceTabs')

    function loadTabs(): Array<{ id: string; name: string; isDefault: boolean; createdAt: number; closedAt: number | null }> {
      // Return cached tabs if available
      if (tabsCache !== null) {
        return tabsCache
      }

      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            tabsCache = parsed
            return parsed
          }
        }
      } catch (error) {
        workspaceLog.error('Failed to load tabs', { error: String(error) })
      }
      // Default tab
      const defaultTab = {
        id: 'main-workspace',
        name: 'Main Workspace',
        isDefault: true,
        createdAt: Date.now(),
        closedAt: null,
      }
      tabsCache = [defaultTab]
      return tabsCache
    }

    function loadAgents(): Record<string, string[]> {
      // Return cached agents if available
      if (agentsCache !== null) {
        return agentsCache
      }

      try {
        const stored = localStorage.getItem(AGENTS_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          agentsCache = parsed
          return parsed
        }
      } catch (error) {
        workspaceLog.error('Failed to load agents', { error: String(error) })
      }
      agentsCache = {}
      return agentsCache
    }

    function saveTabs(tabs: Array<{ id: string; name: string; isDefault: boolean; createdAt: number; closedAt: number | null }>): boolean {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
        tabsCache = tabs // Update cache
        return true
      } catch (error) {
        workspaceLog.error('Failed to save tabs', { error: String(error) })
        return false
      }
    }

    function saveAgents(agents: Record<string, string[]>): boolean {
      try {
        localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(agents))
        agentsCache = agents // Update cache
        return true
      } catch (error) {
        workspaceLog.error('Failed to save agents', { error: String(error) })
        return false
      }
    }

    let currentTabId: string | null = null

    return {
      initialize: async (): Promise<unknown> => {
        workspaceLog.debug('Initializing workspace tabs')
        try {
          const tabs = loadTabs()
          const agents = loadAgents()
          // Find the first non-closed tab or default to first
          const activeTab = tabs.find(t => !t.closedAt) || tabs[0]
          currentTabId = activeTab?.id || null
          
          const result = {
            tabs: tabs.filter(t => !t.closedAt),
            currentTabId,
            agents,
          }
          workspaceLog.debug('Initialized', { tabCount: result.tabs.length, currentTabId: currentTabId })
          return result
        } catch (error) {
          workspaceLog.error('Initialization failed', { error: String(error) })
          // Return default state on error
          const defaultTab = {
            id: 'main-workspace',
            name: 'Main Workspace',
            isDefault: true,
            createdAt: Date.now(),
            closedAt: null,
          }
          currentTabId = defaultTab.id
          return {
            tabs: [defaultTab],
            currentTabId,
            agents: {},
          }
        }
      },

      create: async (name: string): Promise<unknown> => {
        workspaceLog.debug('Creating tab', { name })
        try {
          const tabs = loadTabs()
          const newTab = {
            id: `workspace-${Date.now()}`,
            name,
            isDefault: false,
            createdAt: Date.now(),
            closedAt: null,
          }
          tabs.push(newTab)
          saveTabs(tabs)
          currentTabId = newTab.id
          workspaceLog.debug('Tab created', { tabId: newTab.id })
          return { tab: newTab, currentTabId }
        } catch (error) {
          workspaceLog.error('Failed to create tab', { error: String(error) })
          throw error
        }
      },

      close: async (tabId: string): Promise<void> => {
        workspaceLog.debug('Closing tab', { tabId })
        try {
          const tabs = loadTabs()
          const tabIndex = tabs.findIndex(t => t.id === tabId)
          if (tabIndex >= 0 && !tabs[tabIndex].isDefault) {
            tabs[tabIndex].closedAt = Date.now()
            saveTabs(tabs)
            // Switch to another tab if closing current
            if (currentTabId === tabId) {
              const nextTab = tabs.find(t => t.id !== tabId && !t.closedAt)
              currentTabId = nextTab?.id || tabs[0]?.id || null
            }
            workspaceLog.debug('Tab closed', { tabId })
          } else {
            workspaceLog.debug('Tab not found or is default', { tabId })
          }
        } catch (error) {
          workspaceLog.error('Failed to close tab', { error: String(error) })
          throw error
        }
      },

      switch: async (tabId: string): Promise<unknown> => {
        workspaceLog.debug('Switching tab', { tabId })
        try {
          const tabs = loadTabs()
          const tab = tabs.find(t => t.id === tabId && !t.closedAt)
          if (tab) {
            currentTabId = tabId
            workspaceLog.debug('Tab switched', { tabId })
            return { success: true, currentTabId }
          }
          workspaceLog.warn('Tab not found', { tabId })
          return { success: false, error: 'Tab not found' }
        } catch (error) {
          workspaceLog.error('Failed to switch tab', { error: String(error) })
          throw error
        }
      },

      rename: async (tabId: string, newName: string): Promise<unknown> => {
        workspaceLog.debug('Renaming tab', { tabId, newName })
        try {
          const tabs = loadTabs()
          const tab = tabs.find(t => t.id === tabId)
          if (tab) {
            tab.name = newName
            saveTabs(tabs)
            workspaceLog.debug('Tab renamed', { tabId })
            return { tab }
          }
          workspaceLog.warn('Tab not found for rename', { tabId })
          return { error: 'Tab not found' }
        } catch (error) {
          workspaceLog.error('Failed to rename tab', { error: String(error) })
          throw error
        }
      },

      list: async (): Promise<unknown> => {
        workspaceLog.debug('Listing tabs')
        try {
          const tabs = loadTabs()
          const result = { tabs: tabs.filter(t => !t.closedAt) }
          workspaceLog.debug('Tabs listed', { count: result.tabs.length })
          return result
        } catch (error) {
          workspaceLog.error('Failed to list tabs', { error: String(error) })
          return { tabs: [] }
        }
      },

      getCurrent: async (): Promise<unknown> => {
        workspaceLog.debug('Getting current tab')
        try {
          const tabs = loadTabs()
          const tab = tabs.find(t => t.id === currentTabId && !t.closedAt)
          const result = { tab: tab || null }
          workspaceLog.debug('Current tab retrieved', { tabId: result.tab?.id || 'none' })
          return result
        } catch (error) {
          workspaceLog.error('Failed to get current tab', { error: String(error) })
          return { tab: null }
        }
      },

      addAgent: async (tabId: string, agentId: string): Promise<void> => {
        workspaceLog.debug('Adding agent to tab', { tabId, agentId })
        try {
          const agents = loadAgents()
          if (!agents[tabId]) {
            agents[tabId] = []
          }
          if (!agents[tabId].includes(agentId)) {
            agents[tabId].push(agentId)
            saveAgents(agents)
            workspaceLog.debug('Agent added to tab', { tabId })
          } else {
            workspaceLog.debug('Agent already exists in tab', { tabId, agentId })
          }
        } catch (error) {
          workspaceLog.error('Failed to add agent to tab', { error: String(error) })
          throw error
        }
      },

      removeAgent: async (tabId: string, agentId: string): Promise<void> => {
        workspaceLog.debug('Removing agent from tab', { tabId, agentId })
        try {
          const agents = loadAgents()
          if (agents[tabId]) {
            agents[tabId] = agents[tabId].filter(id => id !== agentId)
            saveAgents(agents)
            workspaceLog.debug('Agent removed from tab', { tabId })
          } else {
            workspaceLog.debug('No agents for tab', { tabId })
          }
        } catch (error) {
          workspaceLog.error('Failed to remove agent from tab', { error: String(error) })
          throw error
        }
      },

      getAgents: async (tabId: string): Promise<unknown> => {
        workspaceLog.debug('Getting agents for tab', { tabId })
        try {
          const agents = loadAgents()
          const result = { agentIds: agents[tabId] || [] }
          workspaceLog.debug('Agents retrieved', { tabId, count: result.agentIds.length })
          return result
        } catch (error) {
          workspaceLog.error('Failed to get agents for tab', { error: String(error) })
          return { agentIds: [] }
        }
      },
    }
  })(),
}

// ─── Dev bridge (browser-only mode) ──────────────────────────────────────────
// Used when running `npm run dev:renderer` directly in a browser.
// When a BYOK key is configured the AI provider is called directly.

let _streamHandler: ((chunk: string) => void) | null = null

/** Notification push in dev mode — dispatched as a DOM CustomEvent. */
const _notifyListeners = new Set<(n: Omit<IToastNotification, 'id'>) => void>()
window.addEventListener('app:notification', (e) => {
  const detail = (e as CustomEvent<Omit<IToastNotification, 'id'>>).detail
  _notifyListeners.forEach((fn) => { fn(detail) })
})

// ── Dev-bridge direct provider constants ──────────────────────────────────────

const DEV_PROVIDER_MODELS: Record<string, string> = {
  anthropic: 'claude-3-5-haiku-20241022',
  google: 'gemini-2.0-flash',
  gemini: 'gemini-2.0-flash',
  groq: 'llama3-8b-8192',
  mistral: 'mistral-small-latest',
}
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

const OPENAI_COMPAT_BASE: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  mistral: 'https://api.mistral.ai/v1',
}
const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1'

// ── SSE stream readers ────────────────────────────────────────────────────────

/**
 * Reads a fetch SSE ReadableStream line by line. Applies `extractChunk` to
 * each `data:` payload and calls `onChunk` with each non-null result.
 * Returns the full concatenated output.
 */
async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  extractChunk: (data: string) => string | null,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let full = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).replace(/\r$/, '')
        buf = buf.slice(nl + 1)
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') return full
          const chunk = extractChunk(data)
          if (chunk) {
            full += chunk
            onChunk?.(chunk)
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  return full
}

function extractOpenAIChunk(data: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
    return parsed.choices?.[0]?.delta?.content ?? null
  } catch { return null }
}

function extractAnthropicChunk(data: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(data) as { type?: string; delta?: { text?: string } }
    if (parsed.type !== 'content_block_delta') return null
    return parsed.delta?.text ?? null
  } catch { return null }
}

function extractGoogleChunk(data: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(data) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? null
  } catch { return null }
}

/**
 * Calls an AI provider directly from browser dev mode using the BYOK key.
 * Forwards each streaming token to `onChunk` and returns the full output.
 */
async function callDevProvider(
  provider: string,
  apiKey: string,
  message: string,
  onChunk?: (chunk: string) => void,
  modelOverride?: string,
): Promise<string> {
  const model = modelOverride ?? DEV_PROVIDER_MODELS[provider] ?? DEFAULT_OPENAI_MODEL

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model, max_tokens: 4096, stream: true,
        messages: [{ role: 'user', content: message }],
      }),
    })
    if (!res.ok || !res.body) throw new Error(`Anthropic API error: ${String(res.status)}`)
    return readSSEStream(res.body, extractAnthropicChunk, onChunk)
  }

  if (provider === 'google' || provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] }),
    })
    if (!res.ok || !res.body) throw new Error(`Google API error: ${String(res.status)}`)
    return readSSEStream(res.body, extractGoogleChunk, onChunk)
  }

  // OpenAI, Groq, Mistral, and other OpenAI-compatible providers.
  const baseUrl = OPENAI_COMPAT_BASE[provider] ?? OPENAI_DEFAULT_BASE
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model, stream: true,
      messages: [{ role: 'user', content: message }],
    }),
  })
  if (!res.ok || !res.body) throw new Error(`${provider} API error: ${String(res.status)}`)
  return readSSEStream(res.body, extractOpenAIChunk, onChunk)
}

/**
 * devBridge — calls AI providers directly over HTTP.
 *
 * Used ONLY when `npm run dev:renderer` is started directly in a browser
 * (no Tauri runtime). Requires a BYOK key to be configured in Settings → API Keys.
 */
const devBridge: IDesktopBridge = {
  // ── Chat ─────────────────────────────────────────────────────────────────
  chat: {
    send: async (message: string, options?: IAiRequestOptions) => {
      // Return a synthetic stub when mock AI is enabled in developer settings.
      const devState = useDevSettingsStore.getState()
      if (devState.enabled && devState.mockAiResponses) {
        const reply = '[Mock] Synthetic AI response — disable "Mock AI responses" in Settings → Developer to use a real provider.'
        for (const char of reply) {
          _streamHandler?.(char)
          await new Promise<void>((resolve) => { setTimeout(resolve, 10) })
        }
        return { output: reply }
      }

      // If a BYOK key is configured, call the AI provider directly.
      if (options?.apiKey && options.provider) {
        const output = await callDevProvider(
          options.provider,
          options.apiKey,
          message,
          (chunk) => { _streamHandler?.(chunk) },
          options.model,
        )
        return { output }
      }

      // No key configured — surface a helpful placeholder via the stream handler.
      const reply = '[Dev mode] No API key configured. Add a key in Settings → API Keys and set it as default.'
      for (const char of reply) {
        if (_streamHandler) _streamHandler(char)
        await new Promise<void>((resolve) => setTimeout(resolve, 12))
      }
      return { output: reply }
    },

    onStream: (handler) => {
      _streamHandler = handler
      return () => { _streamHandler = null }
    },
  },

  // ── Modules ──────────────────────────────────────────────────────────────
  modules: sharedModules,

  // ── AI ───────────────────────────────────────────────────────────────────
  ai: {
    generate: async (capability: string, input: string, _context?: Record<string, unknown>, options?: IAiRequestOptions): Promise<{ output: string; tokensUsed: number }> => {
      const devState = useDevSettingsStore.getState()
      if (devState.enabled && devState.mockAiResponses) {
        return { output: `[Mock] Synthetic ${capability} response — disable "Mock AI responses" in Settings → Developer to use a real provider.`, tokensUsed: 0 }
      }

      if (options?.apiKey && options.provider) {
        const prompt = `[${capability}] ${input}`
        const output = await callDevProvider(options.provider, options.apiKey, prompt, undefined, options.model)
        return { output, tokensUsed: 0 }
      }
      return {
        output: '[Dev mode] No API key configured. Add a key in Settings → API Keys and set it as default.',
        tokensUsed: 0,
      }
    },
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  // Uses DOM CustomEvent dispatched by module-bootstrap notifyRenderer callback.
  notifications: {
    onPush: (handler) => {
      _notifyListeners.add(handler)
      return () => { _notifyListeners.delete(handler) }
    },
  },

  // ── Health ────────────────────────────────────────────────────────────────
  health: {
    check: async () => {
      try {
        const res = await fetch(`${getGatewayBase()}/health/detailed`)
        if (!res.ok) return { status: 'degraded' as const, components: {}, timestamp: new Date().toISOString() }
        return res.json() as Promise<{ status: 'ok' | 'degraded' | 'down'; components: Record<string, string>; timestamp: string }>
      } catch {
        return { status: 'down' as const, components: {}, timestamp: new Date().toISOString() }
      }
    },
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    status: (): Promise<{ authenticated: boolean; userId?: string; plan?: string }> =>
      Promise.resolve({
        authenticated: Boolean(DEV_TOKEN),
        userId: 'dev-user',
        plan: 'pro',
      }),

    login: async (clientId: string, clientSecret: string) => {
      const res = await fetch(`${getGatewayBase()}/v1/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
      })
      if (!res.ok) throw new Error(`Login failed: ${String(res.status)}`)
    },

    logout: async () => { /* Dev mode: nothing to clear */ },
  },

  // ── Usage ─────────────────────────────────────────────────────────────────
  usage: {
    summary: async () => {
      const res = await fetch(`${getGatewayBase()}/v1/usage`, {
        headers: { Authorization: `Bearer ${DEV_TOKEN}` },
      })
      if (!res.ok) return { inputTokens: 0, outputTokens: 0, windowStartUnix: 0 }
      const raw = await res.json() as {
        input_tokens?: number
        output_tokens?: number
        window_start_unix?: number
      }
      return {
        inputTokens: raw.input_tokens ?? 0,
        outputTokens: raw.output_tokens ?? 0,
        windowStartUnix: raw.window_start_unix ?? 0,
      }
    },
  },

  // ── App ───────────────────────────────────────────────────────────────────
  app: {
    version: (): Promise<string> => Promise.resolve('1.0.0-dev'),
  },

  // ── Agents ─────────────────────────────────────────────────────────────────
  agents: {
    poll: async (): Promise<IAgentPollResult | null> => {
      try {
        const res = await fetch(`${getGatewayBase()}/v1/agents/poll`, {
          headers: { Authorization: `Bearer ${DEV_TOKEN}` },
        })
        if (res.status === 204) return null
        if (!res.ok) return null
        return res.json() as Promise<IAgentPollResult>
      } catch {
        return null
      }
    },

    updateRun: async (runId: string, update: IAgentRunUpdate): Promise<void> => {
      const res = await fetch(`${getGatewayBase()}/v1/agents/runs/${runId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEV_TOKEN}`,
        },
        body: JSON.stringify(update),
      })
      if (!res.ok && res.status !== 204) {
        throw new Error(`updateRun failed: ${String(res.status)}`)
      }
    },
  },

  // ── Metrics ────────────────────────────────────────────────────────────────
  metrics: {
    getExecutionSummary: (_payload: { executionId: string }): Promise<unknown> =>
      Promise.resolve(null),
    getDailyUsage: (_payload: { date: string }): Promise<unknown> =>
      Promise.resolve(null),
    getAgentBreakdown: (_payload: { date: string }): Promise<unknown> =>
      Promise.resolve(null),
    getAllExecutions: (): Promise<readonly string[]> =>
      Promise.resolve([]),
    exportReport: (_payload: { fromDate: string; toDate: string }): Promise<unknown> =>
      Promise.resolve(null),
    getSummary: (_payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> =>
      Promise.resolve(null),
    getTokens: (_payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> =>
      Promise.resolve(null),
    getCosts: (_payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> =>
      Promise.resolve(null),
    getAgents: (_payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> =>
      Promise.resolve(null),
    getExecutions: (_payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> =>
      Promise.resolve(null),
    getTools: (_payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> =>
      Promise.resolve(null),
    getModels: (_payload: { fromDate: string; toDate: string; agentId?: string; model?: string; workspaceId?: string }): Promise<unknown> =>
      Promise.resolve(null),
    exportData: (_payload: { fromDate: string; toDate: string }): Promise<unknown> =>
      Promise.resolve(null),
  },

  // ── Workspace ────────────────────────────────────────────────────────────────
  workspace: {
    initialize: (): Promise<unknown> =>
      Promise.resolve({ workspaces: [], activeWorkspaceId: null }),
    create: (payload: { name: string }): Promise<unknown> =>
      Promise.resolve({ workspace: { id: `ws-${Date.now()}`, name: payload.name } }),
    delete: (_payload: { workspaceId: string }): Promise<void> =>
      Promise.resolve(),
    rename: (_payload: { workspaceId: string; newName: string }): Promise<unknown> =>
      Promise.resolve({ success: true }),
    switch: (_payload: { workspaceId: string }): Promise<unknown> =>
      Promise.resolve({ success: true }),
    list: (): Promise<unknown> =>
      Promise.resolve({ workspaces: [] }),
    getActive: (): Promise<unknown> =>
      Promise.resolve({ workspace: null }),
    duplicate: (_payload: { sourceWorkspaceId: string; newName: string }): Promise<unknown> =>
      Promise.resolve({ workspace: { id: `ws-${Date.now()}`, name: _payload.newName } }),
  },

  // ── Workspace Tabs (dev mode - localStorage) ───────────────────────────────────
  workspaceTabs: (() => {
    const STORAGE_KEY = 'dev-workspace-tabs'
    const AGENTS_STORAGE_KEY = 'dev-workspace-agents'

    function loadTabs(): Array<{ id: string; name: string; isDefault: boolean; createdAt: number; closedAt: number | null }> {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
          }
        }
      } catch {
        // Ignore parse errors
      }
      // Default tab
      return [{
        id: 'main-workspace',
        name: 'Main Workspace',
        isDefault: true,
        createdAt: Date.now(),
        closedAt: null,
      }]
    }

    function loadAgents(): Record<string, string[]> {
      try {
        const stored = localStorage.getItem(AGENTS_STORAGE_KEY)
        if (stored) {
          return JSON.parse(stored)
        }
      } catch {
        // Ignore parse errors
      }
      return {}
    }

    function saveTabs(tabs: Array<{ id: string; name: string; isDefault: boolean; createdAt: number; closedAt: number | null }>): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
      } catch {
        // Ignore storage errors
      }
    }

    function saveAgents(agents: Record<string, string[]>): void {
      try {
        localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(agents))
      } catch {
        // Ignore storage errors
      }
    }

    let currentTabId: string | null = null

    return {
      initialize: async (): Promise<unknown> => {
        const tabs = loadTabs()
        const agents = loadAgents()
        // Find the first non-closed tab or default to first
        const activeTab = tabs.find(t => !t.closedAt) || tabs[0]
        currentTabId = activeTab?.id || null
        return {
          tabs: tabs.filter(t => !t.closedAt),
          currentTabId,
          agents,
        }
      },

      create: async (name: string): Promise<unknown> => {
        const tabs = loadTabs()
        const newTab = {
          id: `workspace-${Date.now()}`,
          name,
          isDefault: false,
          createdAt: Date.now(),
          closedAt: null,
        }
        tabs.push(newTab)
        saveTabs(tabs)
        currentTabId = newTab.id
        return { tab: newTab, currentTabId }
      },

      close: async (tabId: string): Promise<void> => {
        const tabs = loadTabs()
        const tabIndex = tabs.findIndex(t => t.id === tabId)
        if (tabIndex >= 0 && !tabs[tabIndex].isDefault) {
          tabs[tabIndex].closedAt = Date.now()
          saveTabs(tabs)
          // Switch to another tab if closing current
          if (currentTabId === tabId) {
            const nextTab = tabs.find(t => t.id !== tabId && !t.closedAt)
            currentTabId = nextTab?.id || tabs[0]?.id || null
          }
        }
      },

      switch: async (tabId: string): Promise<unknown> => {
        const tabs = loadTabs()
        const tab = tabs.find(t => t.id === tabId && !t.closedAt)
        if (tab) {
          currentTabId = tabId
          return { success: true, currentTabId }
        }
        return { success: false, error: 'Tab not found' }
      },

      rename: async (tabId: string, newName: string): Promise<unknown> => {
        const tabs = loadTabs()
        const tab = tabs.find(t => t.id === tabId)
        if (tab) {
          tab.name = newName
          saveTabs(tabs)
          return { tab }
        }
        return { error: 'Tab not found' }
      },

      list: async (): Promise<unknown> => {
        const tabs = loadTabs()
        return { tabs: tabs.filter(t => !t.closedAt) }
      },

      getCurrent: async (): Promise<unknown> => {
        const tabs = loadTabs()
        const tab = tabs.find(t => t.id === currentTabId && !t.closedAt)
        return { tab: tab || null }
      },

      addAgent: async (tabId: string, agentId: string): Promise<void> => {
        const agents = loadAgents()
        if (!agents[tabId]) {
          agents[tabId] = []
        }
        if (!agents[tabId].includes(agentId)) {
          agents[tabId].push(agentId)
          saveAgents(agents)
        }
      },

      removeAgent: async (tabId: string, agentId: string): Promise<void> => {
        const agents = loadAgents()
        if (agents[tabId]) {
          agents[tabId] = agents[tabId].filter(id => id !== agentId)
          saveAgents(agents)
        }
      },

      getAgents: async (tabId: string): Promise<unknown> => {
        const agents = loadAgents()
        return { agentIds: agents[tabId] || [] }
      },
    }
  })(),
}

/**
 * Returns the Tauri bridge when running inside Tauri, or the HTTP dev bridge
 * when running `npm run dev:renderer` directly in a browser.
 */
export function getDesktopBridge(): IDesktopBridge {
  return IS_TAURI ? tauriBridge : devBridge
}
