/**
 * CapabilityGuard — enforces capability boundaries for tool execution.
 *
 * Throws CapabilityViolationError if an agent lacks required capabilities.
 * Main process only. Deterministic. No randomness.
 */

export class CapabilityViolationError extends Error {
    public readonly agentCapabilities: readonly string[]
    public readonly requiredCapabilities: readonly string[]
    public readonly missingCapabilities: readonly string[]

    constructor(
        agentCapabilities: readonly string[],
        requiredCapabilities: readonly string[],
        missingCapabilities: readonly string[],
    ) {
        super(
            `Capability violation: missing [${missingCapabilities.join(', ')}]. ` +
            `Agent has [${agentCapabilities.join(', ')}], ` +
            `tool requires [${requiredCapabilities.join(', ')}]`,
        )
        this.name = 'CapabilityViolationError'
        this.agentCapabilities = agentCapabilities
        this.requiredCapabilities = requiredCapabilities
        this.missingCapabilities = missingCapabilities
    }
}

export class CapabilityGuard {
    ensure(
        agentCapabilities: readonly string[],
        requiredCapabilities: readonly string[],
    ): void {
        if (requiredCapabilities.length === 0) return

        const missing = requiredCapabilities.filter(
            (cap) => !agentCapabilities.includes(cap),
        )

        if (missing.length > 0) {
            throw new CapabilityViolationError(
                agentCapabilities,
                requiredCapabilities,
                missing,
            )
        }
    }

    check(
        agentCapabilities: readonly string[],
        requiredCapabilities: readonly string[],
    ): { readonly granted: boolean; readonly missing: readonly string[] } {
        if (requiredCapabilities.length === 0) {
            return { granted: true, missing: [] }
        }

        const missing = requiredCapabilities.filter(
            (cap) => !agentCapabilities.includes(cap),
        )

        return { granted: missing.length === 0, missing }
    }
}
