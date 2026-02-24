/**
 * PlanningHeuristic — deterministic rules for whether input requires planning.
 *
 * Rules:
 * - < 40 tokens → false (direct execute)
 * - Contains planning keywords → true
 * - ≥ 2 sentences → true
 * - Otherwise → false
 *
 * No randomness. No LLM calls. Pure function.
 */

import { PLANNING_LIMITS, PLANNING_KEYWORDS } from './PlanningTypes.js'

function estimateTokenCount(input: string): number {
    return Math.ceil(input.split(/\s+/).filter(Boolean).length * 1.3)
}

function countSentences(input: string): number {
    const matches = input.match(/[.!?]+/g)
    return matches ? matches.length : 0
}

function containsPlanningKeyword(input: string): boolean {
    const lower = input.toLowerCase()
    return PLANNING_KEYWORDS.some((kw) => lower.includes(kw))
}

export function shouldPlan(input: string): boolean {
    const tokenCount = estimateTokenCount(input)

    if (tokenCount < PLANNING_LIMITS.MIN_TOKEN_THRESHOLD) {
        return false
    }

    if (containsPlanningKeyword(input)) {
        return true
    }

    if (countSentences(input) >= 2) {
        return true
    }

    return false
}
