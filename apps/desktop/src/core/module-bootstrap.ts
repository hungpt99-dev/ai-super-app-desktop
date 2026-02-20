import type { INotifyOptions } from '@ai-super-app/sdk'
import { PermissionEngine } from './permission-engine.js'
import { ModuleManager } from './module-manager.js'
import { BUILTIN_MODULES } from './builtin-modules.js'
import { logger } from '@ai-super-app/shared'

const log = logger.child('ModuleBootstrap')

const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const CORE_VERSION = '1.0.0'

let _moduleManager: ModuleManager | null = null

/**
 * Initialise the TypeScript module manager and activate all built-in modules.
 *
 * Must be called once at app startup (from App.tsx useEffect) before any
 * bridge.modules.* method is invoked. Idempotent — safe to call multiple times.
 *
 * The notification callback bridges module ctx.ui.notify() to the desktop
 * notification layer:
 *   - Tauri: emits a `notification:push` Tauri event (received by bridge.notifications.onPush)
 *   - Browser dev: dispatches a DOM CustomEvent on `window`
 */
export async function initModuleManager(): Promise<ModuleManager> {
  if (_moduleManager) return _moduleManager

  const permEngine = new PermissionEngine()

  const notifyRenderer = (options: INotifyOptions): void => {
    if (IS_TAURI) {
      void import('@tauri-apps/api/event').then(({ emit }) => {
        void emit('notification:push', options)
      })
    } else {
      window.dispatchEvent(new CustomEvent('app:notification', { detail: options }))
    }
  }

  const mm = new ModuleManager(permEngine, CORE_VERSION, notifyRenderer)

  for (const { id, definition } of BUILTIN_MODULES) {
    mm.registerBuiltin(id, definition)
    await mm.activate(id)
  }

  _moduleManager = mm
  log.info('Module manager initialised', { modules: BUILTIN_MODULES.map((m) => m.id) })
  return mm
}

/**
 * Returns the singleton module manager.
 * Returns null if called before initModuleManager() completes —
 * callers should handle the null case gracefully (e.g. return empty list).
 */
export function getModuleManager(): ModuleManager | null {
  return _moduleManager
}
