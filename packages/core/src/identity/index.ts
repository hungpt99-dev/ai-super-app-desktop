/**
 * Identity domain — agent identity resolution and management.
 *
 * See: docs/technical-design.md §7 MULTI-AGENT SYSTEM
 */

// ─── Agent Identity ────────────────────────────────────────────────────────

export interface IAgentIdentity {
    readonly agentId: string
    readonly name: string
    readonly version: string
    readonly owner?: string
}

// ─── Identity Resolver ──────────────────────────────────────────────────────

export interface IIdentityResolver {
    /** Resolve an agent identity by ID. */
    resolve(agentId: string): Promise<IAgentIdentity | null>
    /** Register an agent identity. */
    register(identity: IAgentIdentity): Promise<void>
    /** List all known agent identities. */
    list(): Promise<IAgentIdentity[]>
}
