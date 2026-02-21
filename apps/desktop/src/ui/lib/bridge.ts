import type { IDesktopBridge, IAiRequestOptions, IToastNotification, IBotPollResult, IBotRunUpdate } from '../../shared/bridge-types.js'
import { getModuleManager } from '../../core/module-bootstrap.js'

/** True when running inside the Tauri WebView runtime. */
const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Cloud Gateway base URL used by the browser dev bridge only.
 * In Tauri, all HTTP calls are made by Rust commands — this constant is unused.
 */
const DEV_GATEWAY: string = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000'
const DEV_TOKEN: string = import.meta.env.VITE_DEV_TOKEN ?? 'dev-token'

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
        ...(options?.apiKey   ? { apiKey:    options.apiKey   } : {}),
        ...(options?.provider ? { provider: options.provider } : {}),
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
  modules: {
    list: (): Promise<{ id: string; name: string; version: string }[]> => {
      const mm = getModuleManager()
      if (!mm) return Promise.resolve([])
      return Promise.resolve(
        Array.from(mm.getActive().entries()).map(([id, def]) => ({
          id,
          name: def.manifest.name,
          version: def.manifest.version,
        }))
      )
    },

    install: (): Promise<void> => Promise.resolve(),
    uninstall: (): Promise<void> => Promise.resolve(),

    invokeTool: (moduleId, toolName, input) =>
      invoke<unknown>('modules_invoke_tool', { moduleId, toolName, input }),
  },

  // ── AI ───────────────────────────────────────────────────────────────────
  ai: {
    generate: async (capability, input, context, options) => {
      const res = await invoke<{ output: string; tokens_used: number }>(
        'ai_generate',
        {
          capability,
          input,
          ...(context            ? { context }             : {}),
          ...(options?.apiKey   ? { apiKey:    options.apiKey   } : {}),
          ...(options?.provider ? { provider: options.provider } : {}),
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

  // ── Bots ──────────────────────────────────────────────────────────────────
  bots: {
    poll: () => invoke<IBotPollResult | null>('bots_poll'),
    updateRun: (runId: string, update: IBotRunUpdate) =>
      invoke<undefined>('bots_update_run', { runId, update }).then(() => undefined),
  },
}

// ─── Dev bridge (browser-only mode) ──────────────────────────────────────────
// Used when running `npm run dev:renderer` directly in a browser.
// All HTTP calls go directly to the cloud gateway with a dev token.

let _streamHandler: ((chunk: string) => void) | null = null

/** Notification push in dev mode — dispatched as a DOM CustomEvent. */
const _notifyListeners = new Set<(n: Omit<IToastNotification, 'id'>) => void>()
window.addEventListener('app:notification', (e) => {
  const detail = (e as CustomEvent<Omit<IToastNotification, 'id'>>).detail
  _notifyListeners.forEach((fn) => { fn(detail) })
})

/**
 * devBridge — calls the real cloud API over HTTP.
 *
 * Used ONLY when `npm run dev:renderer` is started directly in a browser
 * (no Tauri runtime). Requires the cloud server to be running.
 */
const devBridge: IDesktopBridge = {
  // ── Chat ─────────────────────────────────────────────────────────────────
  chat: {
    send: async (message: string, _options?: IAiRequestOptions) => {
      // Dev-mode stub — the AI streaming endpoint is not available without a
      // live Tauri + backend session. Simulates a streaming response.
      const preview = message.slice(0, 80) + (message.length > 80 ? '…' : '')
      const reply = `[Dev mode] Received: “${preview}”. Start the full app to enable AI responses.`
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
  modules: {
    list: (): Promise<{ id: string; name: string; version: string }[]> => {
      const mm = getModuleManager()
      if (!mm) return Promise.resolve([])
      return Promise.resolve(
        Array.from(mm.getActive().entries()).map(([id, def]) => ({
          id,
          name: def.manifest.name,
          version: def.manifest.version,
        }))
      )
    },

    install: (): Promise<void> => Promise.resolve(),
    uninstall: (): Promise<void> => Promise.resolve(),

    invokeTool: (moduleId: string, toolName: string): Promise<unknown> => {
      // Dev-mode stub — module tool invocation requires a live Tauri + backend session.
      throw new Error(`[Dev mode] Module tool ${moduleId}/${toolName} is not available without the full app.`)
    },
  },

  // ── AI ───────────────────────────────────────────────────────────────────
  ai: {
    generate: (_capability: string, _input: string, _context?: Record<string, unknown>, _options?: IAiRequestOptions): Promise<{ output: string; tokensUsed: number }> =>
      // Dev-mode stub — AI generation requires a live Tauri + backend session.
      Promise.resolve({
        output: '[Dev mode] AI generation is not available without the full app.',
        tokensUsed: 0,
      }),
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
        const res = await fetch(`${DEV_GATEWAY}/health/detailed`)
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
      const res = await fetch(`${DEV_GATEWAY}/v1/auth/token`, {
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
      const res = await fetch(`${DEV_GATEWAY}/v1/usage`, {
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

  // ── Bots ──────────────────────────────────────────────────────────────────
  bots: {
    poll: async (): Promise<IBotPollResult | null> => {
      try {
        const res = await fetch(`${DEV_GATEWAY}/v1/bots/poll`, {
          headers: { Authorization: `Bearer ${DEV_TOKEN}` },
        })
        if (res.status === 204) return null
        if (!res.ok) return null
        return res.json() as Promise<IBotPollResult>
      } catch {
        return null
      }
    },

    updateRun: async (runId: string, update: IBotRunUpdate): Promise<void> => {
      const res = await fetch(`${DEV_GATEWAY}/v1/bots/runs/${runId}`, {
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
}

/**
 * Returns the Tauri bridge when running inside Tauri, or the HTTP dev bridge
 * when running `npm run dev:renderer` directly in a browser.
 */
export function getDesktopBridge(): IDesktopBridge {
  return IS_TAURI ? tauriBridge : devBridge
}
