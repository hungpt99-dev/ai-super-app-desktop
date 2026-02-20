/**
 * IDesktopBridge — the typed API surface exposed from the Electron preload
 * script to the renderer via contextBridge.
 *
 * This file lives in src/ so both the renderer (Vite) and the preload script
 * (tsc) can import it without crossing the src/electron boundary.
 */

/** Notification payload forwarded from module ctx.ui.notify() to the renderer. */
export interface IToastNotification {
  id: string
  title: string
  body: string
  level: 'info' | 'success' | 'warning' | 'error'
}

/** Go backend health report shape. */
export interface IHealthReport {
  status: 'ok' | 'degraded' | 'down'
  components: Record<string, string>
  timestamp: string
}

/** Current auth state reported by the main process. */
export interface IAuthStatus {
  authenticated: boolean
  userId?: string
  plan?: string
}

/** Usage summary from the backend /v1/usage endpoint. */
export interface IUsageSummary {
  inputTokens: number
  outputTokens: number
  windowStartUnix: number
}

export interface IDesktopBridge {
  chat: {
    send(message: string): Promise<{ output: string }>
    onStream(handler: (chunk: string) => void): () => void
  }
  modules: {
    list(): Promise<Array<{ id: string; name: string; version: string }>>
    install(packagePath: string): Promise<void>
    uninstall(moduleId: string): Promise<void>
    /** Invoke a specific tool belonging to a module */
    invokeTool(
      moduleId: string,
      toolName: string,
      input: Record<string, unknown>,
    ): Promise<unknown>
  }
  ai: {
    /** Direct AI call for module UIs — wraps the cloud gateway */
    generate(
      capability: string,
      input: string,
      context?: Record<string, unknown>,
    ): Promise<{ output: string; tokensUsed: number }>
  }
  notifications: {
    /** Subscribe to push notifications from modules / main process. */
    onPush(handler: (notification: Omit<IToastNotification, 'id'>) => void): () => void
  }
  health: {
    /** Probe the Go backend and its dependencies (Postgres, Redis). */
    check(): Promise<IHealthReport>
  }
  auth: {
    /** Current token status (non-blocking, reads cached state). */
    status(): Promise<IAuthStatus>
    /** Exchange client credentials for a JWT. Persists token in TokenStore. */
    login(clientId: string, clientSecret: string): Promise<void>
    /** Clear the stored token. */
    logout(): Promise<void>
  }
  usage: {
    /** Fetch usage summary for the current user from the backend. */
    summary(): Promise<IUsageSummary>
  }
  app: {
    version(): Promise<string>
  }
}
