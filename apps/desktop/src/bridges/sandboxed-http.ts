/**
 * sandboxed-http.ts
 *
 * Permission-enforced HTTP client exposed to modules as `ctx.http`.
 *
 * Security hardening:
 * - Rejects dangerous URL schemes (file://, javascript:, data:)
 * - Warns on localhost/private network access
 * - Enforces response body size limit (10 MB default)
 * - Timeout via AbortController (30 s default)
 * - All requests require Permission.NetworkFetch
 */

import type { IHttpAPI, IHttpRequestOptions, IHttpResponse } from '@agenthub/sdk'
import { Permission } from '@agenthub/sdk'
import type { PermissionEngine } from '@agenthub/core'
import { logger } from '@agenthub/shared'

const log = logger.child('SandboxedHttp')

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_RESPONSE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/** URL schemes that modules are never allowed to access. */
const BLOCKED_SCHEMES = new Set(['file:', 'javascript:', 'data:', 'blob:'])

/** Private/internal network patterns modules should not normally access. */
const PRIVATE_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  '169.254.',    // link-local
  '10.',         // private class A
  '192.168.',    // private class C
]

export class SandboxedHttp implements IHttpAPI {
  constructor(
    private readonly moduleId: string,
    private readonly permissionEngine: PermissionEngine,
  ) { }

  // ── Convenience wrappers ────────────────────────────────────────────────────

  async get<T = unknown>(
    url: string,
    options?: Omit<IHttpRequestOptions, 'method' | 'body'>,
  ): Promise<IHttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' })
  }

  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<IHttpRequestOptions, 'method' | 'body'>,
  ): Promise<IHttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body })
  }

  async put<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<IHttpRequestOptions, 'method' | 'body'>,
  ): Promise<IHttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PUT', body })
  }

  async patch<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<IHttpRequestOptions, 'method' | 'body'>,
  ): Promise<IHttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PATCH', body })
  }

  async delete<T = unknown>(
    url: string,
    options?: Omit<IHttpRequestOptions, 'method' | 'body'>,
  ): Promise<IHttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' })
  }

  // ── Low-level request ───────────────────────────────────────────────────────

  async request<T = unknown>(
    url: string,
    options: IHttpRequestOptions = {},
  ): Promise<IHttpResponse<T>> {
    this.permissionEngine.check(this.moduleId, Permission.NetworkFetch)
    this.validateUrl(url)

    const {
      method = 'GET',
      headers = {},
      body,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    } = options

    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, timeoutMs)

    const fetchHeaders: Record<string, string> = { ...headers }
    let fetchBody: BodyInit | undefined

    if (body !== undefined) {
      if (typeof body === 'string' || body instanceof FormData || body instanceof URLSearchParams) {
        fetchBody = body as BodyInit
      } else {
        fetchBody = JSON.stringify(body)
        fetchHeaders['Content-Type'] ??= 'application/json'
      }
    }

    log.debug('http.request', { moduleId: this.moduleId, method, url })

    try {
      const res = await fetch(url, {
        method,
        headers: fetchHeaders,
        ...(fetchBody !== undefined ? { body: fetchBody } : {}),
        signal: controller.signal,
      })

      // Enforce response size limit
      const text = await this.readBodyWithLimit(res)

      let data: T
      try {
        data = JSON.parse(text) as T
      } catch {
        data = text as unknown as T
      }

      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => { responseHeaders[key] = value })

      if (!res.ok) {
        log.warn('http.response error', { moduleId: this.moduleId, status: res.status, url, body: text.slice(0, 500) })
      } else {
        log.debug('http.response', { moduleId: this.moduleId, status: res.status, url })
      }

      return {
        status: res.status,
        ok: res.ok,
        headers: responseHeaders,
        data,
        text,
      }
    } catch (err) {
      log.error('http.request failed', { moduleId: this.moduleId, method, url, err: err instanceof Error ? err.message : String(err) })
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  // ── Security ───────────────────────────────────────────────────────────────

  /** Reject dangerous URL schemes and warn on private network access. */
  private validateUrl(url: string): void {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error(`Invalid URL: ${url}`)
    }

    if (BLOCKED_SCHEMES.has(parsed.protocol)) {
      throw new Error(
        `Blocked URL scheme "${parsed.protocol}" — modules may only use http: or https:`,
      )
    }

    const host = parsed.hostname.toLowerCase()
    const isPrivate = PRIVATE_HOSTS.some((p) => host === p || host.startsWith(p))
    if (isPrivate) {
      log.warn('Module accessing private/local network', {
        moduleId: this.moduleId,
        host,
        url,
      })
    }
  }

  /** Read response body text with a hard byte limit to prevent memory exhaustion. */
  private async readBodyWithLimit(res: Response): Promise<string> {
    const contentLength = res.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE_BYTES) {
      throw new Error(
        `Response body too large: ${contentLength} bytes (max: ${String(MAX_RESPONSE_SIZE_BYTES)})`,
      )
    }

    // No Content-Length header → stream and enforce limit manually
    const reader = res.body?.getReader()
    if (!reader) return ''

    const chunks: Uint8Array[] = []
    let totalBytes = 0

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_RESPONSE_SIZE_BYTES) {
        await reader.cancel()
        throw new Error(
          `Response body exceeded ${String(MAX_RESPONSE_SIZE_BYTES)} byte limit`,
        )
      }
      chunks.push(value)
    }

    // Decode once — avoids repeated TextDecoder allocations
    const merged = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new TextDecoder().decode(merged)
  }
}
