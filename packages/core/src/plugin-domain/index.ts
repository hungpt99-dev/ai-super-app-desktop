/**
 * PluginDomain — core ports for the plugin system.
 *
 * Plugins are external extensions that register tools, skills,
 * model providers, and middleware. They run in sandboxed environments
 * and cannot access core internals directly.
 */

// ─── Plugin Types ───────────────────────────────────────────────────────────

export interface IPluginManifest {
    readonly id: string
    readonly name: string
    readonly version: string
    readonly description: string
    readonly author?: string
    readonly entryPoint: string
    readonly permissions: readonly string[]
    readonly minCoreVersion: string
    readonly maxCoreVersion: string
}

export type PluginStatus = 'installed' | 'active' | 'inactive' | 'error' | 'uninstalled'

export interface IPluginInfo {
    readonly manifest: IPluginManifest
    readonly status: PluginStatus
    readonly installedAt: string
    readonly activatedAt?: string
    readonly error?: string
}

// ─── Plugin Context ─────────────────────────────────────────────────────────

export interface IPluginToolRegistration {
    readonly name: string
    readonly description: string
    readonly inputSchema: Record<string, unknown>
    readonly handler: (input: Record<string, unknown>) => Promise<unknown>
}

export interface IPluginSkillRegistration {
    readonly id: string
    readonly name: string
    readonly version: string
    readonly description: string
    readonly category: string
    readonly requiredCapabilities: readonly string[]
    readonly permissions: readonly string[]
    readonly tools: readonly IPluginToolRegistration[]
}

export interface IPluginModelProviderRegistration {
    readonly id: string
    readonly name: string
    readonly models: readonly string[]
    readonly generate: (request: Record<string, unknown>) => Promise<Record<string, unknown>>
    readonly stream?: (request: Record<string, unknown>) => AsyncIterable<string>
}

export type MiddlewarePhase = 'pre-execution' | 'post-execution' | 'pre-tool' | 'post-tool'

export interface IPluginMiddlewareRegistration {
    readonly id: string
    readonly phase: MiddlewarePhase
    readonly priority: number
    readonly handler: (context: Record<string, unknown>) => Promise<Record<string, unknown>>
}

export interface IPluginContext {
    registerTool(tool: IPluginToolRegistration): void
    registerSkill(skill: IPluginSkillRegistration): void
    registerModelProvider(provider: IPluginModelProviderRegistration): void
    registerMiddleware(middleware: IPluginMiddlewareRegistration): void
}

// ─── Plugin Contract ────────────────────────────────────────────────────────

export interface IAgentHubPlugin {
    readonly id: string
    readonly version: string
    register(context: IPluginContext): void
}

// ─── Plugin Registry Port ───────────────────────────────────────────────────

export interface IPluginRegistryPort {
    install(manifest: IPluginManifest, entryPath: string): Promise<void>
    uninstall(pluginId: string): Promise<void>
    activate(pluginId: string): Promise<void>
    deactivate(pluginId: string): Promise<void>
    getPlugin(pluginId: string): Promise<IPluginInfo | null>
    listPlugins(): Promise<readonly IPluginInfo[]>
    getRegisteredTools(pluginId: string): readonly IPluginToolRegistration[]
    getRegisteredSkills(pluginId: string): readonly IPluginSkillRegistration[]
    getRegisteredProviders(pluginId: string): readonly IPluginModelProviderRegistration[]
    getRegisteredMiddleware(pluginId: string): readonly IPluginMiddlewareRegistration[]
    getAllMiddleware(phase: MiddlewarePhase): readonly IPluginMiddlewareRegistration[]
}
