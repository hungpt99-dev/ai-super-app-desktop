/**
 * Policy domain — runtime policy evaluation and enforcement.
 *
 * Policies govern what actions agents are allowed to perform.
 * The policy engine evaluates rules before each privileged operation.
 *
 * See: docs/technical-design.md §10 SECURITY ARCHITECTURE
 */

// ─── Policy Decision ───────────────────────────────────────────────────────

export type PolicyDecision = 'allow' | 'deny' | 'prompt'

// ─── Policy ─────────────────────────────────────────────────────────────────

export interface IPolicy {
    readonly name: string
    readonly description: string
    /** Evaluate whether an action is permitted for a given agent. */
    evaluate(agentId: string, action: string, context?: Record<string, unknown>): PolicyDecision
}

// ─── Policy Engine ──────────────────────────────────────────────────────────

export interface IPolicyEngine {
    /** Add a policy rule. */
    addPolicy(policy: IPolicy): void
    /** Remove a policy by name. */
    removePolicy(name: string): void
    /** Evaluate all policies for a given agent and action. Returns the strictest decision. */
    evaluate(agentId: string, action: string, context?: Record<string, unknown>): PolicyDecision
    /** List all registered policies. */
    list(): IPolicy[]
}
