/**
 * Capability domain — declares what an agent can do.
 *
 * Capabilities are registered with the runtime and checked
 * before execution of privileged operations.
 */

// ─── Capability ─────────────────────────────────────────────────────────────

export interface ICapability {
    readonly name: string
    readonly description: string
}

// ─── Capability Registry ────────────────────────────────────────────────────

export interface ICapabilityRegistry {
    /** Register a capability. */
    register(capability: ICapability): void
    /** Get a capability by name. Returns null if not found. */
    get(name: string): ICapability | null
    /** List all registered capabilities. */
    list(): ICapability[]
    /** Check if a capability is registered. */
    has(name: string): boolean
}
