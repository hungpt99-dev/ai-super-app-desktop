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
  anthropic: 'claude-3-haiku-20240307',
  google:    'gemini-1.5-flash',
  gemini:    'gemini-1.5-flash',
  groq:      'llama3-8b-8192',
  mistral:   'mistral-small-latest',
}
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

const OPENAI_COMPAT_BASE: Record<string, string> = {
  groq:    'https://api.groq.com/openai/v1',
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
): Promise<string> {
  const model = DEV_PROVIDER_MODELS[provider] ?? DEFAULT_OPENAI_MODEL

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
      // If a BYOK key is configured, call the AI provider directly.
      if (options?.apiKey && options.provider) {
        const output = await callDevProvider(
          options.provider,
          options.apiKey,
          message,
          (chunk) => { _streamHandler?.(chunk) },
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
    generate: async (capability: string, input: string, _context?: Record<string, unknown>, options?: IAiRequestOptions): Promise<{ output: string; tokensUsed: number }> => {
      if (options?.apiKey && options.provider) {
        const prompt = `[${capability}] ${input}`
        const output = await callDevProvider(options.provider, options.apiKey, prompt)
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
