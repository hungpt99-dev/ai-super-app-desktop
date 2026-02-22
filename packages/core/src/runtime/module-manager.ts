import type { IAppPackage, IModuleDefinition, IModuleManager, IToolInput, Permission } from '@agenthub/sdk'
import type { PermissionEngine } from './permission-engine.js'
import type { ISandboxFactory } from './types.js'
import {
    ModuleInstallError,
    ModuleNotFoundError,
    ModuleVersionIncompatibleError,
    PermissionDeniedError,
    ValidationError,
    logger,
} from '@agenthub/shared'
import { isSemverCompatible } from '@agenthub/shared'

const log = logger.child('ModuleManager')

/**
 * IModuleContext provider — the sandbox factory creates sandboxed contexts.
 * This abstraction keeps the ModuleManager free of Tauri/desktop-specific imports.
 */
export interface IModuleSandboxHandle {
    activate(): Promise<void>
    deactivate(): Promise<void>
    getCtx(): import('@agenthub/sdk').IModuleContext | null
}

/**
 * ModuleManager — Façade + Registry Pattern.
 *
 * Single entry point for all module lifecycle operations.
 * Delegates sandbox creation, permission granting, and signature checks.
 *
 * Core never directly imports Tauri/browser/platform APIs:
 * - Sandbox creation → ISandboxFactory (injected)
 * - Signature verification → callback (injected)
 * - Module loading → IModuleLoader on ISandboxFactory (injected)
 */
export class ModuleManager implements IModuleManager {
    /** moduleId → loaded definition */
    private readonly registry = new Map<string, IModuleDefinition>()
    /** moduleId → sandbox handle */
    private readonly sandboxes = new Map<string, IModuleSandboxHandle>()

    /**
     * Optional async callback invoked before permissions are granted.
     * Return false to block activation (user denied).
     */
    private permissionRequestHandler?: (
        moduleId: string,
        permissions: readonly Permission[],
    ) => Promise<boolean>

    constructor(
        private readonly permissionEngine: PermissionEngine,
        private readonly coreVersion: string,
        private readonly sandboxFactory: ISandboxFactory,
        private readonly signatureVerifier?: (pkg: IAppPackage) => Promise<void>,
    ) { }

    async install(pkg: IAppPackage): Promise<void> {
        if (this.signatureVerifier) {
            await this.signatureVerifier(pkg)
        }
        this.verifyVersion(pkg)

        const definition = await this.loadDefinition(pkg)
        const moduleId = pkg.manifest.name

        this.registry.set(moduleId, definition)
        log.info('Module installed', { moduleId, version: pkg.manifest.version })
    }

    /** Wire the UI-layer handler that is called before permissions are granted on activate(). */
    setPermissionRequestHandler(
        handler: (moduleId: string, permissions: readonly Permission[]) => Promise<boolean>,
    ): void {
        this.permissionRequestHandler = handler
    }

    async activate(moduleId: string): Promise<void> {
        this.validateId(moduleId, 'moduleId')

        const definition = this.registry.get(moduleId)
        if (!definition) throw new ModuleNotFoundError(`Module not found: ${moduleId}`)

        // Prevent double-activation
        if (this.sandboxes.has(moduleId)) {
            log.warn('Module already active, skipping re-activation', { moduleId })
            return
        }

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

        const sandbox = this.sandboxFactory.create(moduleId, definition)
        await sandbox.activate()

        this.sandboxes.set(moduleId, sandbox)
        log.info('Module activated', { moduleId })
    }

    async deactivate(moduleId: string): Promise<void> {
        this.validateId(moduleId, 'moduleId')

        const sandbox = this.sandboxes.get(moduleId)
        if (!sandbox) throw new ModuleNotFoundError(`Module not active: ${moduleId}`)

        try {
            await sandbox.deactivate()
        } finally {
            // Always clean up even if deactivate throws
            this.sandboxes.delete(moduleId)
            this.permissionEngine.revoke(moduleId)
        }
        log.info('Module deactivated', { moduleId })
    }

    async uninstall(moduleId: string): Promise<void> {
        this.validateId(moduleId, 'moduleId')

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
        this.validateId(moduleId, 'moduleId')
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
        this.validateId(moduleId, 'moduleId')
        this.validateId(toolName, 'toolName')

        const definition = this.registry.get(moduleId)
        if (!definition) throw new ModuleNotFoundError(`Module not found: ${moduleId}`)

        const tool = definition.tools.find((t) => t.name === toolName)
        if (!tool) throw new ModuleNotFoundError(`Tool "${toolName}" not found in module "${moduleId}"`)

        const ctx = await this.ensureActiveContext(moduleId)
        return this.executeTool(tool, input, ctx, moduleId, toolName)
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /** Ensure a module has an active sandbox context, activating on demand if needed. */
    private async ensureActiveContext(moduleId: string): Promise<import('@agenthub/sdk').IModuleContext> {
        const sandbox = this.sandboxes.get(moduleId)
        const ctx = sandbox?.getCtx() ?? null

        if (ctx) return ctx

        log.warn('runTool called on non-active module — activating on demand', { moduleId })
        await this.activate(moduleId)

        const freshCtx = this.sandboxes.get(moduleId)?.getCtx() ?? null
        if (!freshCtx) throw new ModuleNotFoundError(`Failed to activate module: ${moduleId}`)
        return freshCtx
    }

    /** Execute a tool with structured error logging. */
    private async executeTool(
        tool: import('@agenthub/sdk').ITool,
        input: IToolInput,
        ctx: import('@agenthub/sdk').IModuleContext,
        moduleId: string,
        toolName: string,
    ): Promise<unknown> {
        try {
            return await tool.run(input, ctx)
        } catch (err) {
            log.error('Tool execution failed', {
                moduleId,
                toolName,
                error: err instanceof Error ? err.message : String(err),
            })
            throw err
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
            // Dynamic import — the entry path resolution is handled
            // by the app-level bootstrap (e.g. Tauri file: → asset: conversion).
            // @vite-ignore suppresses the Vite static-analysis warning for the dynamic path.
            const mod = await import(/* @vite-ignore */ pkg.entryPath) as { default?: IModuleDefinition }
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

    private validateId(value: string, name: string): void {
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
            throw new ValidationError(`${name} must be a non-empty string`, { [name]: value })
        }
    }
}
