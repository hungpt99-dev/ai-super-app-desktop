import type { IAiClient, IAiGenerateRequest, IAiGenerateResponse } from '@agenthub/sdk'
import { logger } from '@agenthub/shared'
import { IS_TAURI } from './runtime.js'

const log = logger.child('AiSdkProxy')

interface IRustGenerateResponse {
  output: string
  tokens_used: number
}

/**
 * AiSdkProxy — bridges module AI calls to the correct transport.
 *
 * In Tauri: delegates to Rust commands (`ai_generate`, `ai_stream`) so that
 *   the Rust layer attaches the stored JWT and handles SSE parsing natively.
 * In browser dev mode: falls back to GatewayClient over plain HTTP.
 *
 * Design rules:
 *   - No retry logic here — GatewayClient / Tauri handles that.
 *   - No token management here — Rust store / TokenStore handle that.
 */
export class AiSdkProxy implements IAiClient {
  async generate(request: IAiGenerateRequest): Promise<IAiGenerateResponse> {
    log.debug('ai.generate', { capability: request.capability })

    if (IS_TAURI) {
      const { invoke } = await import('@tauri-apps/api/core')
      const res = await invoke<IRustGenerateResponse>('ai_generate', {
        capability: request.capability,
        input: request.input,
        ...(request.context ? { context: request.context } : {}),
        ...(request.apiKey ? { apiKey: request.apiKey } : {}),
        ...(request.provider ? { provider: request.provider } : {}),
      })
      return { output: res.output, model: '', tokensUsed: res.tokens_used }
    }

    // Dev-mode: delegate to the desktop bridge which uses BYOK keys directly.
    log.debug('ai.generate — dev mode, delegating to desktop bridge')
    const { getDesktopBridge } = await import('../ui/lib/bridge.js')
    const bridge = getDesktopBridge()
    const res = await bridge.ai.generate(
      request.capability,
      request.input,
      request.context as Record<string, unknown> | undefined,
      request.apiKey && request.provider
        ? { apiKey: request.apiKey, provider: request.provider }
        : undefined,
    )
    return { output: res.output, model: '', tokensUsed: res.tokensUsed ?? 0 }
  }

  async *stream(request: IAiGenerateRequest): AsyncIterable<string> {
    log.debug('ai.stream', { capability: request.capability })

    if (IS_TAURI) {
      yield* this._tauriStream(request)
      return
    }

    // Dev-mode: delegate to the desktop bridge (BYOK streaming).
    log.debug('ai.stream — dev mode, delegating to desktop bridge')
    const { getDesktopBridge } = await import('../ui/lib/bridge.js')
    const bridge = getDesktopBridge()
    const opts = request.apiKey && request.provider
      ? { apiKey: request.apiKey, provider: request.provider }
      : undefined
    const chunks: string[] = []
    let resolve: (() => void) | null = null
    let finished = false
    const unsub = bridge.chat.onStream((chunk) => { chunks.push(chunk); resolve?.(); resolve = null })
    try {
      void bridge.chat.send(`[${request.capability}] ${request.input}`, opts).then(() => { finished = true; resolve?.(); resolve = null })
      while (!finished || chunks.length > 0) {
        if (chunks.length === 0) await new Promise<void>((r) => { resolve = r })
        while (chunks.length > 0) yield chunks.shift()!
      }
    } finally {
      unsub()
    }
  }

  /**
   * Tauri streaming — starts the Rust `ai_stream` command (which emits
   * `ai:stream-chunk` events as it reads the SSE response) and yields each
   * chunk as it arrives using an async generator backed by a bounded buffer.
   *
   * Listeners are registered BEFORE invoking to avoid any race condition.
   * Errors from the Rust command are propagated to the generator consumer.
   */
  private async *_tauriStream(request: IAiGenerateRequest): AsyncIterable<string> {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    const buffer: string[] = []
    let done = false
    let streamError: Error | null = null
    let wakeUp: (() => void) | null = null

    const unlistenChunk = await listen<string>('ai:stream-chunk', (e) => {
      buffer.push(e.payload)
      if (wakeUp !== null) { wakeUp(); wakeUp = null }
    })

    const unlistenDone = await listen<undefined>('ai:stream-done', () => {
      done = true
      if (wakeUp !== null) { wakeUp(); wakeUp = null }
    })

    // Fire-and-forget — Rust emits events while this generator consumes them.
    const invokePromise = invoke('ai_stream', {
      capability: request.capability,
      input: request.input,
      ...(request.context ? { context: request.context } : {}),
      ...(request.apiKey ? { apiKey: request.apiKey } : {}),
      ...(request.provider ? { provider: request.provider } : {}),
    }).catch((err: unknown) => {
      streamError = err instanceof Error ? err : new Error(String(err))
      done = true
      if (wakeUp !== null) { wakeUp(); wakeUp = null }
    })

    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (!done || buffer.length > 0) {
        if (buffer.length === 0) {
          // Park until the next event arrives.
          await new Promise<void>((resolve) => { wakeUp = resolve })
        }
        while (buffer.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          yield buffer.shift()!
        }
      }
      // Re-throw any error from the Rust invoke after draining the buffer.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (streamError !== null) throw streamError as Error
    } finally {
      unlistenChunk()
      unlistenDone()
      await invokePromise
    }
  }
}
