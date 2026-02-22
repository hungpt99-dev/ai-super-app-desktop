import type { IAppPackage, IModuleDefinition, IModuleManager, INotifyOptions, IToolInput, Permission } from '@agenthub/sdk'
import type { PermissionEngine } from './permission-engine.js'

/** True when running inside the Tauri WebView runtime. */
const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
import { ModuleSandbox } from './module-sandbox.js'
import {
  ModuleInstallError,
  ModuleNotFoundError,
  ModuleVersionIncompatibleError,
  PermissionDeniedError,
  SignatureVerificationError,
  logger,
} from '@agenthub/shared'
import { isSemverCompatible } from '@agenthub/shared'

const log = logger.child('ModuleManager')

/**
 * ModuleManager — Façade + Registry Pattern.
 *
 * Single entry point for all module lifecycle operations.
 * Delegates sandbox creation, permission granting, and signature checks.
 */
export class ModuleManager implements IModuleManager {
  /** moduleId → loaded definition */
  private readonly registry = new Map<string, IModuleDefinition>()
  /** moduleId → sandbox instance */
  private readonly sandboxes = new Map<string, ModuleSandbox>()

  /**
   * Optional async callback invoked before permissions are granted.
   * Return false to block activation (user denied).
   */
  private permissionRequestHandler?: (
    moduleId: string,
    permissions: Permission[],
  ) => Promise<boolean>

  constructor(
    private readonly permissionEngine: PermissionEngine,
    private readonly coreVersion: string,
    private readonly notifyRenderer?: (options: INotifyOptions) => void,
  ) {}

  async install(pkg: IAppPackage): Promise<void> {
    await this.verifySignature(pkg)
    this.verifyVersion(pkg)

    const definition = await this.loadDefinition(pkg)
    const moduleId = pkg.manifest.name

    this.registry.set(moduleId, definition)
    log.info('Module installed', { moduleId, version: pkg.manifest.version })
  }

  /** Wire the UI-layer handler that is called before permissions are granted on activate(). */
  setPermissionRequestHandler(
    handler: (moduleId: string, permissions: Permission[]) => Promise<boolean>,
  ): void {
    this.permissionRequestHandler = handler
  }

  async activate(moduleId: string): Promise<void> {
    const definition = this.registry.get(moduleId)
    if (!definition) throw new ModuleNotFoundError(`Module not found: ${moduleId}`)

    if (this.permissionRequestHandler) {
      const approved = await this.permissionRequestHandler(
        moduleId,
        definition.manifest.permissions,
      )
      if (!approved) {
        log.warn('Module activation denied by user', { moduleId })
        throw new PermissionDeniedError(
          `User denied permissions for module: ${moduleId}`,
          { moduleId },
        )
      }
    }

    this.permissionEngine.grant(moduleId, definition.manifest.permissions)

    const sandbox = new ModuleSandbox(moduleId, definition, this.permissionEngine, this.notifyRenderer)
    await sandbox.activate()

    this.sandboxes.set(moduleId, sandbox)
    log.info('Module activated', { moduleId })
  }

  async deactivate(moduleId: string): Promise<void> {
    const sandbox = this.sandboxes.get(moduleId)
    if (!sandbox) throw new ModuleNotFoundError(`Module not active: ${moduleId}`)

    await sandbox.deactivate()
    this.sandboxes.delete(moduleId)
    this.permissionEngine.revoke(moduleId)
    log.info('Module deactivated', { moduleId })
  }

  async uninstall(moduleId: string): Promise<void> {
    if (this.sandboxes.has(moduleId)) {
      await this.deactivate(moduleId)
    }
    this.registry.delete(moduleId)
    log.info('Module uninstalled', { moduleId })
  }

  /**
   * Returns a map of all currently active (sandboxed) module definitions.
   * A module is active after activate() succeeds and before deactivate() is called.
   */
  getActive(): ReadonlyMap<string, IModuleDefinition> {
    const result = new Map<string, IModuleDefinition>()
    for (const [id] of this.sandboxes) {
      const def = this.registry.get(id)
      if (def) result.set(id, def)
    }
    return result
  }

  /**
   * Register a first-party built-in module directly — bypasses IAppPackage
   * signature + checksum verification (not needed for bundled modules).
   * Must call activate(moduleId) separately.
   */
  registerBuiltin(moduleId: string, definition: IModuleDefinition): void {
    this.registry.set(moduleId, definition)
    log.info('Built-in module registered', { moduleId, version: definition.manifest.version })
  }

  /**
   * Run a named tool on an already-active module using its real sandboxed context.
   * This is the correct path for IPC tool invocations — the context carries
   * real AI + storage proxies with permission enforcement.
   */
  async runTool(
    moduleId: string,
    toolName: string,
    input: IToolInput,
  ): Promise<unknown> {
    const definition = this.registry.get(moduleId)
    if (!definition) throw new ModuleNotFoundError(`Module not found: ${moduleId}`)

    const tool = definition.tools.find((t) => t.name === toolName)
    if (!tool) throw new ModuleNotFoundError(`Tool "${toolName}" not found in module "${moduleId}"`)

    const sandbox = this.sandboxes.get(moduleId)
    const ctx = sandbox?.getCtx() ?? null

    if (!ctx) {
      log.warn('runTool called on non-active module — activating on demand', { moduleId })
      await this.activate(moduleId)
      const reloadedSandbox = this.sandboxes.get(moduleId)
      const freshCtx = reloadedSandbox?.getCtx() ?? null
      if (!freshCtx) throw new ModuleNotFoundError(`Failed to activate module: ${moduleId}`)
      try {
        return await tool.run(input, freshCtx)
      } catch (err) {
        log.error('Tool execution failed', { moduleId, toolName, err: err instanceof Error ? err.message : String(err) })
        throw err
      }
    }

    try {
      return await tool.run(input, ctx)
    } catch (err) {
      log.error('Tool execution failed', { moduleId, toolName, err: err instanceof Error ? err.message : String(err) })
      throw err
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Verify the SHA-256 checksum of the module entry file.
   *
   * Uses the Tauri FS plugin (`@tauri-apps/plugin-fs`) in production and
   * skips verification in browser dev mode (no filesystem access).
   * Uses Web Crypto `crypto.subtle` — no Node.js dependency.
   */
  private async verifySignature(pkg: IAppPackage): Promise<void> {
    if (!IS_TAURI) {
      // Browser dev mode: filesystem not available — skip checksum check.
      return
    }

    const { readFile } = await import('@tauri-apps/plugin-fs')
    const bytes = await readFile(pkg.entryPath)

    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
    const actual = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    if (actual !== pkg.checksum) {
      throw new SignatureVerificationError(
        `Checksum mismatch for module: ${pkg.manifest.name}`,
        { expected: pkg.checksum, actual },
      )
    }
  }

  private verifyVersion(pkg: IAppPackage): void {
    const { minCoreVersion, maxCoreVersion, name } = pkg.manifest
    if (!isSemverCompatible(this.coreVersion, minCoreVersion, maxCoreVersion)) {
      throw new ModuleVersionIncompatibleError(
        `Module "${name}" is incompatible with core version ${this.coreVersion}`,
        { coreVersion: this.coreVersion, minCoreVersion, maxCoreVersion },
      )
    }
  }

  private async loadDefinition(pkg: IAppPackage): Promise<IModuleDefinition> {
    try {
      // In Tauri, file paths must be converted to an asset: URL before dynamic import.
      let importPath = pkg.entryPath
      if (IS_TAURI) {
        const { convertFileSrc } = await import('@tauri-apps/api/core')
        importPath = convertFileSrc(pkg.entryPath)
      }

      // Dynamic import is safe here because signature was already verified.
      // @vite-ignore suppresses the Vite static-analysis warning for the dynamic path.
      const mod = await import(/* @vite-ignore */ importPath) as { default?: IModuleDefinition }
      if (!mod.default) {
        throw new ModuleInstallError(`Module "${pkg.manifest.name}" has no default export`)
      }
      return mod.default
    } catch (e) {
      if (e instanceof ModuleInstallError) throw e
      throw new ModuleInstallError(
        `Failed to load module: ${pkg.manifest.name}`,
        { cause: e instanceof Error ? e.message : String(e) },
      )
    }
  }
}
