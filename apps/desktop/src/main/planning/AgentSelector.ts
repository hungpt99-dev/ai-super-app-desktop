/**
 * AgentSelector — deterministic agent selection for planning.
 *
 * Selection rules:
 * 1. Pre-filter by required capability codes
 * 2. Sort by:
 *    a. Capability match score (descending)
 *    b. Cost per token (ascending)
 *    c. Alphabetical by name (ascending)
 * 3. Return max 3 candidates
 *
 * No randomness. Deterministic ordering guaranteed.
 */

import type { AgentCandidate } from './PlanningTypes.js'
import { PLANNING_LIMITS } from './PlanningTypes.js'

function computeCapabilityScore(
    agentCapabilities: readonly string[],
    requiredCapabilities: readonly string[],
): number {
    if (requiredCapabilities.length === 0) return 1
    let matched = 0
    for (const req of requiredCapabilities) {
        if (agentCapabilities.includes(req)) {
            matched++
        }
    }
    return matched / requiredCapabilities.length
}

export function selectAgents(
    candidates: readonly AgentCandidate[],
    requiredCapabilities: readonly string[],
): readonly AgentCandidate[] {
    const filtered = candidates.filter((agent) => {
        if (requiredCapabilities.length === 0) return true
        return requiredCapabilities.every((cap) => agent.capabilities.includes(cap))
    })

    const sorted = [...filtered].sort((a, b) => {
        const scoreA = computeCapabilityScore(a.capabilities, requiredCapabilities)
        const scoreB = computeCapabilityScore(b.capabilities, requiredCapabilities)

        if (scoreB !== scoreA) return scoreB - scoreA

        if (a.costPerToken !== b.costPerToken) return a.costPerToken - b.costPerToken

        return a.name.localeCompare(b.name)
    })

    return sorted.slice(0, PLANNING_LIMITS.MAX_AGENT_CANDIDATES)
}
