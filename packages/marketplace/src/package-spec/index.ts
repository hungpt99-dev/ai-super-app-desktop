/**
 * package-spec/index.ts
 *
 * Defines the structure and manifest requirements for an Agent Package (.ahub).
 * See docs §12.1 Marketplace & Distribution.
 */

export interface IAgentManifest {
    name: string
    version: string
    description: string
    author: string
    engine_version: string // Required core version compatibility
    permissions: string[] // e.g. ['memory_read', 'network.fetch']
    entrypoint: string // path to main graph.json or js file
}

export interface IAgentPackage {
    /** The parsed manifest.json. */
    manifest: IAgentManifest
    /** The serialized graph definition (graph.json). */
    graphRaw: string
    /** Base64 or Blob contents of included tools/ scripts. */
    tools: Record<string, string>
    /** Base64 or Blob contents of included prompts. */
    prompts: Record<string, string>
    /** Base64 or Blob contents of optional UI bundles. */
    ui?: Record<string, string>
}
