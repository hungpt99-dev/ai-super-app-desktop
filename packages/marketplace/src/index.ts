/**
 * Marketplace Package — agent package validation, installation, and distribution.
 *
 * See: docs/technical-design.md §12 MARKETPLACE SYSTEM
 */

// ─── Agent Package Spec ─────────────────────────────────────────────────────

/**
 * Agent package specification (.ahub / .ahpkg).
 * Contains: manifest.json, graph.json, tools/, ui/, prompts/
 */
export interface IAgentPackageSpec {
    readonly manifest: IAgentManifest
    readonly graphJson?: Record<string, unknown>
    readonly tools: string[]
    readonly uiSchemas: string[]
    readonly prompts: string[]
}

export interface IAgentManifest {
    readonly name: string
    readonly version: string
    readonly engineVersion: string
    readonly author: string
    readonly description: string
    readonly permissions: string[]
    /** SHA-256 signature of the package content. */
    readonly signature: string
}

// ─── Package Validator ──────────────────────────────────────────────────────

export interface IPackageValidationResult {
    readonly valid: boolean
    readonly errors: string[]
    readonly warnings: string[]
}

export interface IPackageValidator {
    /** Validate the package structure and signature. */
    validate(pkg: IAgentPackageSpec): Promise<IPackageValidationResult>
    /** Verify the developer signature against the package content. */
    verifySignature(pkg: IAgentPackageSpec): Promise<boolean>
    /** Check engine version compatibility. */
    checkCompatibility(pkg: IAgentPackageSpec, engineVersion: string): boolean
}

// ─── Package Installer ──────────────────────────────────────────────────────

export interface IPackageInstaller {
    /** Install a validated agent package. */
    install(pkg: IAgentPackageSpec): Promise<void>
    /** Uninstall an agent package by name. */
    uninstall(name: string): Promise<void>
    /** List all installed agent packages. */
    list(): Promise<IAgentManifest[]>
    /** Check if a package is installed. */
    isInstalled(name: string): Promise<boolean>
}

// ─── Marketplace Client ─────────────────────────────────────────────────────

export interface IMarketplaceSearchResult {
    readonly packages: IAgentManifest[]
    readonly total: number
    readonly page: number
}

export interface IMarketplaceClient {
    /** Search for agent packages in the marketplace. */
    search(query: string, page?: number): Promise<IMarketplaceSearchResult>
    /** Download a specific version of an agent package. */
    download(name: string, version: string): Promise<IAgentPackageSpec>
    /** Publish an agent package to the marketplace. */
    publish(pkg: IAgentPackageSpec): Promise<void>
}

export * from './installer/index.js'
export * from './validator/index.js'
