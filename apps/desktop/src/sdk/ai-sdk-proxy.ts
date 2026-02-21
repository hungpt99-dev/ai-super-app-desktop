import type { IAiClient, IAiGenerateRequest, IAiGenerateResponse } from '@ai-super-app/sdk'
import { logger } from '@ai-super-app/shared'

const log = logger.child('AiSdkProxy')

/** True when running inside the Tauri WebView runtime. */
const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

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
        ...(request.context  ? { context:  request.context  } : {}),
        ...(request.apiKey   ? { apiKey:   request.apiKey   } : {}),
        ...(request.provider ? { provider: request.provider } : {}),
      })
      return { output: res.output, model: '', tokensUsed: res.tokens_used }
    }

    // Dev-mode stub — the AI generate endpoint is not available without the full app.
    log.warn('ai.generate called in browser dev mode — returning stub')
    return {
      output: '[Dev mode] AI generation is not available without the full app.',
      model: '',
      tokensUsed: 0,
    }
  }

  async *stream(request: IAiGenerateRequest): AsyncIterable<string> {
    log.debug('ai.stream', { capability: request.capability })

    if (IS_TAURI) {
      yield* this._tauriStream(request)
      return
    }

    // Dev-mode stub — the AI stream endpoint is not available without the full app.
    log.warn('ai.stream called in browser dev mode — returning stub')
    yield '[Dev mode] AI streaming is not available without the full app.'
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
      ...(request.context  ? { context:  request.context  } : {}),
      ...(request.apiKey   ? { apiKey:   request.apiKey   } : {}),
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
