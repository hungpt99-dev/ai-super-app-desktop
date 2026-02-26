/**
 * Lazy Module Loader — loads modules on demand to reduce memory usage.
 *
 * Responsibilities:
 * - Lazy load modules only when needed
 * - Cache loaded modules
 * - Unload unused modules
 * - Support module hot-swapping
 */

import { logger } from '@agenthub/shared'

const log = logger.child('LazyModuleLoader')

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface IModuleLoader {
    readonly id: string
    readonly version: string
    load(): Promise<unknown>
    unload(): Promise<void>
}

export interface ILoadedModule {
    readonly id: string
    readonly module: unknown
    readonly loadedAt: number
    readonly lastUsed: number
    useCount: number
}

// ─── Lazy Module Loader ────────────────────────────────────────────────────────────

class GlobalModuleLoader {
    private static instance: GlobalModuleLoader | null = null
    private readonly modules = new Map<string, ILoadedModule>() // moduleId -> loaded module
    private readonly loaders = new Map<string, () => Promise<unknown>>() // moduleId -> loader function

    static getInstance(): GlobalModuleLoader {
        if (GlobalModuleLoader.instance === null) {
            GlobalModuleLoader.instance = new GlobalModuleLoader()
        }
        return GlobalModuleLoader.instance
    }

    static resetForTesting(): void {
        GlobalModuleLoader.instance = null
    }

    /**
     * Register a module loader
     */
    register(moduleId: string, loader: () => Promise<unknown>): void {
        this.loaders.set(moduleId, loader)
        log.debug('Registered module loader', { moduleId })
    }

    /**
     * Unregister a module loader
     */
    unregister(moduleId: string): void {
        this.loaders.delete(moduleId)
        this.modules.delete(moduleId)
        log.debug('Unregistered module loader', { moduleId })
    }

    /**
     * Load a module (lazy)
     */
    async load<T>(moduleId: string): Promise<T> {
        // Check if already loaded
        const existing = this.modules.get(moduleId)
        if (existing !== undefined) {
            existing.lastUsed = Date.now()
            existing.useCount++
            return existing.module as T
        }

        // Get loader
        const loader = this.loaders.get(moduleId)
        if (loader === undefined) {
            throw new Error(`No loader registered for module: ${moduleId}`)
        }

        // Load module
        log.info('Loading module', { moduleId })
        const module = await loader()
        
        const loadedModule: ILoadedModule = {
            id: moduleId,
            module,
            loadedAt: Date.now(),
            lastUsed: Date.now(),
            useCount: 1,
        }
        
        this.modules.set(moduleId, loadedModule)
        
        log.info('Module loaded', { moduleId })
        
        return module as T
    }

    /**
     * Unload a module
     */
    async unload(moduleId: string): Promise<void> {
        const loaded = this.modules.get(moduleId)
        if (loaded === undefined) return

        // Call cleanup if available
        if (typeof (loaded.module as { dispose?: () => Promise<void> })?.dispose === 'function') {
            await (loaded.module as { dispose: () => Promise<void> }).dispose()
        }

        this.modules.delete(moduleId)
        log.info('Module unloaded', { moduleId })
    }

    /**
     * Get a loaded module
     */
    get<T>(moduleId: string): T | null {
        const loaded = this.modules.get(moduleId)
        if (loaded === undefined) return null
        
        loaded.lastUsed = Date.now()
        return loaded.module as T
    }

    /**
     * Check if module is loaded
     */
    isLoaded(moduleId: string): boolean {
        return this.modules.has(moduleId)
    }

    /**
     * Unload unused modules
     */
    async unloadUnused(maxAgeMs: number = 30 * 60 * 1000): Promise<number> {
        const now = Date.now()
        let unloaded = 0

        for (const [moduleId, loaded] of this.modules.entries()) {
            if (now - loaded.lastUsed > maxAgeMs) {
                await this.unload(moduleId)
                unloaded++
            }
        }

        if (unloaded > 0) {
            log.info('Unloaded unused modules', { count: unloaded })
        }

        return unloaded
    }

    /**
     * Get stats
     */
    getStats(): { loadedCount: number; loaderCount: number } {
        return {
            loadedCount: this.modules.size,
            loaderCount: this.loaders.size,
        }
    }
}

export const moduleLoader = GlobalModuleLoader.getInstance()

// ─── Convenience Functions ────────────────────────────────────────────────────────

export function registerModule(loader: () => Promise<unknown>): (moduleId: string) => void {
    return (moduleId: string) => {
        moduleLoader.register(moduleId, loader)
    }
}

export async function loadModule<T>(moduleId: string): Promise<T> {
    return moduleLoader.load<T>(moduleId)
}

export function getModule<T>(moduleId: string): T | null {
    return moduleLoader.get<T>(moduleId)
}

export async function unloadModule(moduleId: string): Promise<void> {
    return moduleLoader.unload(moduleId)
}
