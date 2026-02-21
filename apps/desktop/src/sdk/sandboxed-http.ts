/**
 * sandboxed-http.ts
 *
 * Permission-enforced HTTP client exposed to modules as `ctx.http`.
 *
 * Internally uses the browser `fetch` API available in Tauri's WebView.
 * All requests are subject to `Permission.NetworkFetch` — any call without
 * that permission granted will throw a PermissionDeniedError immediately.
 *
 * Timeout is implemented via `AbortController`; the default is 30 s.
 * Objects passed as `body` are automatically JSON-serialised and the
 * `Content-Type: application/json` header is set unless overridden.
 */

import type { IHttpAPI, IHttpRequestOptions, IHttpResponse } from '@ai-super-app/sdk'
import { Permission } from '@ai-super-app/sdk'
import type { PermissionEngine } from '../core/permission-engine.js'
import { logger } from '@ai-super-app/shared'

const log = logger.child('SandboxedHttp')

const DEFAULT_TIMEOUT_MS = 30_000

export class SandboxedHttp implements IHttpAPI {
  constructor(
    private readonly moduleId: string,
    private readonly permissionEngine: PermissionEngine,
  ) {}

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

      const text = await res.text()

      let data: T
      try {
        data = JSON.parse(text) as T
      } catch {
        data = text as unknown as T
      }

      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => { responseHeaders[key] = value })

      log.debug('http.response', { moduleId: this.moduleId, status: res.status, url })

      return {
        status: res.status,
        ok: res.ok,
        headers: responseHeaders,
        data,
        text,
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
