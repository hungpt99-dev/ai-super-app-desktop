/**
 * dev-sideload-store.ts
 *
 * Dev-mode sideloading: install a real agent package (.js file that exports
 * `defineModule(...)`) at runtime without going through the marketplace.
 *
 * Mental model
 * ────────────
 * An agent is a mini-app — a self-contained JS module with its own tools, AI
 * interactions, storage and (optionally) a UI panel.  At runtime the code
 * runs inside ModuleManager's sandbox with full permission enforcement, just
 * like a built-in module.
 *
 * The sideload flow (dev mode only)
 * ──────────────────────────────────
 *   1.  Developer drops a compiled .js file onto the sideload panel.
 *   2.  The browser creates a Blob URL and `import()`s it dynamically.
 *   3.  We validate the default export is an IModuleDefinition.
 *   4.  The module is registered + activated via ModuleManager.
 *   5.  A template card derived from the manifest appears in the Agents tab.
 *   6.  The user can create agent instances from it and run them immediately.
 *
 * Persistence
 * ───────────
 * The derived template METADATA is persisted to localStorage so the cards
 * survive page reloads.  The MODULE CODE cannot be persisted (Blob URL
 * lifetime = current session), so the developer must re-drop the file after
 * a reload to make the module executable again.  The card will still be
 * visible but the agent will error on tool calls until re-loaded.
 */

import { create } from 'zustand'
import { getActiveModules, getModuleManager } from '../../../app/module-bootstrap.js'
import type { IAgentTemplate } from '../agent-templates.js'
import type { IModuleDefinition } from '@agenthub/sdk'

const STORAGE_KEY = 'agenthub:dev-sideloaded-modules'

// ─── Sideloaded module record ─────────────────────────────────────────────────

/** Persisted metadata derived from the module manifest after a successful sideload. */
export interface ISideloadedModule extends IAgentTemplate {
  /** Module version string from the manifest. */
  version: string
  /** Module author from the manifest. */
  author: string
  /** ISO timestamp of when this module was last sideloaded. */
  loadedAt: string
  /**
   * Whether the module code is currently loaded in the ModuleManager.
   * false after a page reload — the user must re-drop the file.
   */
  codeLoaded: boolean
}

// ─── Load result ─────────────────────────────────────────────────────────────

export type ISideloadResult =
  | { ok: true; module: ISideloadedModule }
  | { ok: false; error: string }

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load an agent package file into the ModuleManager.
 *
 * The file must be a compiled JS module whose default export is the result
 * of `defineModule({ manifest, tools, permissions, onActivate })`.
 *
 * Signature / checksum verification is intentionally skipped in dev mode.
 * The module is registered as a built-in (bypasses IAppPackage signing).
 */
export async function sideloadFile(file: File): Promise<ISideloadResult> {
  const mm = getModuleManager()
  if (!mm) {
    return { ok: false, error: 'Sideloading is currently disabled in the new AgentRuntime core.' }
  }

  // 1. Read the file into a Blob URL so we can dynamic-import it.
  let blobUrl: string | null = null
  try {
    const text = await file.text()
    const blob = new Blob([text], { type: 'text/javascript' })
    blobUrl = URL.createObjectURL(blob)
  } catch (e) {
    return { ok: false, error: `Could not read file: ${(e as Error).message}` }
  }

  // 2. Dynamic import — the module must have a default export.
  let definition: IModuleDefinition
  try {
    // @vite-ignore — dynamic path is intentional in dev sideloading.
    const mod = await import(/* @vite-ignore */ blobUrl) as { default?: unknown }
    if (!mod.default || typeof mod.default !== 'object') {
      return { ok: false, error: 'The file has no default export. Make sure you export a `defineModule(...)` result.' }
    }
    definition = mod.default as IModuleDefinition
  } catch (e) {
    return { ok: false, error: `Failed to import module: ${(e as Error).message}` }
  } finally {
    // Revoke the Blob URL immediately — ModuleManager already holds the reference.
    URL.revokeObjectURL(blobUrl)
  }

  // 3. Validate the exported object looks like an IModuleDefinition.
  if (!definition.manifest?.name || typeof definition.manifest.name !== 'string') {
    return { ok: false, error: 'module.manifest.name is missing or not a string.' }
  }
  if (!Array.isArray(definition.tools)) {
    return { ok: false, error: 'module.tools must be an array (can be empty []).' }
  }
  if (typeof definition.onActivate !== 'function') {
    return { ok: false, error: 'module.onActivate must be an async function.' }
  }

  const { name, version = '0.0.0', description = '', author = 'unknown' } = definition.manifest

  // 4. Deactivate + uninstall any previous version of the same module.
  try {
    await mm.uninstall(name)
  } catch { /* not previously installed — fine */ }

  // 5. Register as a built-in (no signature check needed in dev mode).
  mm.registerBuiltin(name, definition)

  // 6. Activate: runs onActivate() inside the sandbox.
  try {
    await mm.activate(name)
  } catch (e) {
    return { ok: false, error: `Module registered but activation failed: ${(e as Error).message}` }
  }

  // 7. Derive template metadata.
  const sideloaded: ISideloadedModule = {
    id: name,
    name,
    description,
    version,
    author,
    icon: '📦',
    colorClass: 'bg-amber-900/30 text-amber-300',
    execSteps: ['Initialise', 'Run tools', 'Process', 'Format output', 'Complete'],
    loadedAt: new Date().toISOString(),
    codeLoaded: true,
  }

  return { ok: true, module: sideloaded }
}

// ─── Store ────────────────────────────────────────────────────────────────────

function readPersisted(): ISideloadedModule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    // Code is never persistent — mark all as unloaded on restore.
    return (JSON.parse(raw) as ISideloadedModule[]).map((m) => ({ ...m, codeLoaded: false }))
  } catch {
    return []
  }
}

function writePersisted(modules: ISideloadedModule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modules))
  } catch { /* ignore */ }
}

interface IDevSideloadStore {
  /** All modules that have been sideloaded this session or previously. */
  modules: ISideloadedModule[]

  /**
   * Load a .js agent package file, register it in the ModuleManager, and add
   * its template card to the Agents tab. Re-loading the same module id hot-reloads it.
   */
  loadFile(file: File): Promise<ISideloadResult>

  /** Mark a module as code-loaded after manual reload. */
  markLoaded(id: string): void

  /** Remove a sideloaded module: deactivates + unregisters from ModuleManager. */
  removeModule(id: string): Promise<void>

  /** Clear all sideloaded modules. */
  clearAll(): Promise<void>
}

export const useDevSideloadStore = create<IDevSideloadStore>((set, get) => ({
  modules: readPersisted(),

  loadFile: async (file) => {
    const result = await sideloadFile(file)
    if (!result.ok) return result

    const { module } = result
    const existing = get().modules.filter((m) => m.id !== module.id)
    const updated = [...existing, module]
    writePersisted(updated)
    set({ modules: updated })
    return result
  },

  markLoaded: (id) => {
    set((s) => ({
      modules: s.modules.map((m) => m.id === id ? { ...m, codeLoaded: true } : m),
    }))
  },

  removeModule: async (id) => {
    const mm = getModuleManager()
    if (mm) {
      try { await (mm as any).uninstall(id) } catch { /* ignore if not loaded */ }
    }
    const updated = get().modules.filter((m) => m.id !== id)
    writePersisted(updated)
    set({ modules: updated })
  },

  clearAll: async () => {
    const mm = getModuleManager()
    if (mm) {
      for (const m of get().modules) {
        try { await (mm as any).uninstall(m.id) } catch { /* ignore */ }
      }
    }
    writePersisted([])
    set({ modules: [] })
  },
}))
