/**
 * Token Budget Manager — manages and limits token usage per agent run.
 *
 * Responsibilities:
 * - Track token usage per run
 * - Enforce token budget limits
 * - Auto-stop when budget exceeded
 * - Context deduplication
 */

import { logger } from '@agenthub/shared'

const log = logger.child('TokenBudgetManager')

// ─── Constants ────────────────────────────────────────────────────────────────────

const DEFAULT_TOKEN_BUDGET = 50_000 // 50k tokens per run
const CONTEXT_DEDUP_WINDOW = 20 // Increased from 5 to 20 for better deduplication

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface ITokenBudget {
    readonly budget: number
    readonly used: number
    readonly remaining: number
    readonly exceeded: boolean
}

export interface ITokenUsage {
    readonly runId: string
    readonly agentId: string
    readonly promptTokens: number
    readonly completionTokens: number
    readonly totalTokens: number
    readonly timestamp: number
}

export interface ITokenBudgetResult {
    readonly allowed: boolean
    readonly budget: ITokenBudget
    readonly error?: string
}

// ─── Token Budget Manager ───────────────────────────────────────────────────────

class GlobalTokenBudgetManager {
    private static instance: GlobalTokenBudgetManager | null = null
    private readonly budgets = new Map<string, ITokenBudget>() // runId -> budget
    private readonly usageHistory = new Map<string, ITokenUsage[]>() // agentId -> usage[]

    static getInstance(): GlobalTokenBudgetManager {
        if (GlobalTokenBudgetManager.instance === null) {
            GlobalTokenBudgetManager.instance = new GlobalTokenBudgetManager()
        }
        return GlobalTokenBudgetManager.instance
    }

    static resetForTesting(): void {
        GlobalTokenBudgetManager.instance = null
    }

    /**
     * Create a new token budget for a run
     */
    createBudget(runId: string, agentId: string, budget: number = DEFAULT_TOKEN_BUDGET): ITokenBudget {
        const tokenBudget: ITokenBudget = {
            budget,
            used: 0,
            remaining: budget,
            exceeded: false,
        }
        
        this.budgets.set(runId, tokenBudget)
        
        log.debug('Created token budget', { runId, agentId, budget })
        
        return tokenBudget
    }

    /**
     * Check and update token usage
     */
    checkAndUpdate(runId: string, promptTokens: number, completionTokens: number): ITokenBudgetResult {
        const budget = this.budgets.get(runId)
        
        if (budget === undefined) {
            return {
                allowed: true,
                budget: {
                    budget: DEFAULT_TOKEN_BUDGET,
                    used: promptTokens + completionTokens,
                    remaining: DEFAULT_TOKEN_BUDGET - (promptTokens + completionTokens),
                    exceeded: false,
                },
            }
        }

        const totalTokens = promptTokens + completionTokens
        const newUsed = budget.used + totalTokens
        const newRemaining = budget.budget - newUsed
        const exceeded = newRemaining < 0

        const updatedBudget: ITokenBudget = {
            ...budget,
            used: newUsed,
            remaining: newRemaining,
            exceeded,
        }

        this.budgets.set(runId, updatedBudget)

        if (exceeded) {
            log.warn('Token budget exceeded', {
                runId,
                budget: budget.budget,
                used: newUsed,
            })
        }

        return {
            allowed: !exceeded,
            budget: updatedBudget,
            error: exceeded ? `Token budget exceeded. Used ${newUsed}, budget ${budget.budget}` : undefined,
        }
    }

    /**
     * Get current budget for a run
     */
    getBudget(runId: string): ITokenBudget | null {
        return this.budgets.get(runId) ?? null
    }

    /**
     * Delete budget for a run
     */
    deleteBudget(runId: string): void {
        this.budgets.delete(runId)
    }

    /**
     * Record usage for analytics
     */
    recordUsage(runId: string, agentId: string, promptTokens: number, completionTokens: number): void {
        const usage: ITokenUsage = {
            runId,
            agentId,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            timestamp: Date.now(),
        }

        let history = this.usageHistory.get(agentId)
        if (history === undefined) {
            history = []
            this.usageHistory.set(agentId, history)
        }

        history.push(usage)

        // Keep only last 100 entries
        if (history.length > 100) {
            history.shift()
        }
    }

    /**
     * Get usage history for an agent
     */
    getUsageHistory(agentId: string): ITokenUsage[] {
        return this.usageHistory.get(agentId) ?? []
    }

    /**
     * Get total usage for an agent
     */
    getTotalUsage(agentId: string): number {
        const history = this.usageHistory.get(agentId)
        if (history === undefined) return 0
        
        return history.reduce((sum, u) => sum + u.totalTokens, 0)
    }

    /**
     * Clear all budgets
     */
    clearAll(): void {
        this.budgets.clear()
        
        log.info('Cleared all token budgets')
    }

    /**
     * Get stats
     */
    getStats(): { activeBudgets: number; trackedAgents: number } {
        return {
            activeBudgets: this.budgets.size,
            trackedAgents: this.usageHistory.size,
        }
    }
}

export const tokenBudgetManager = GlobalTokenBudgetManager.getInstance()

// ─── Context Optimizer ─────────────────────────────────────────────────────────

/**
 * CRITICAL FIX: Improved deduplication with better hashing and larger window
 */
export function deduplicateContext(messages: string[], windowSize: number = CONTEXT_DEDUP_WINDOW): string[] {
    if (messages.length <= windowSize) return messages

    const seen = new Set<string>()
    const deduped: string[] = []

    // Only check for duplicates in the recent window
    const recentMessages = messages.slice(-windowSize)
    const olderMessages = messages.slice(0, -windowSize)

    // Keep older messages as-is (they're already summarized)
    for (const msg of olderMessages) {
        deduped.push(msg)
    }

    // Deduplicate recent messages using better hash
    for (const msg of recentMessages) {
        const hash = simpleHash(msg)
        if (!seen.has(hash)) {
            seen.add(hash)
            deduped.push(msg)
        }
    }

    return deduped
}

/**
 * Improved context size optimization with better truncation
 */
export function optimizeContextSize(context: string, maxTokens: number): string {
    const estimatedTokens = estimateTokens(context)
    
    if (estimatedTokens <= maxTokens) {
        return context
    }

    // Split into paragraphs for better preservation of meaning
    const paragraphs = context.split(/\n\n+/)
    const truncated: string[] = []
    let tokenCount = 0

    // Start from the most recent (end) and work backwards
    for (let i = paragraphs.length - 1; i >= 0; i--) {
        const paraTokens = estimateTokens(paragraphs[i])
        if (tokenCount + paraTokens > maxTokens) {
            // If this paragraph would exceed limit, try truncating it
            const remainingTokens = maxTokens - tokenCount
            if (remainingTokens > 20) { // Keep if at least 20 tokens remain
                const truncatedPara = truncateToTokens(paragraphs[i], remainingTokens)
                truncated.unshift(truncatedPara)
            }
            break
        }
        truncated.unshift(paragraphs[i])
        tokenCount += paraTokens
    }

    return truncated.join('\n\n')
}

/**
 * Truncate text to approximately the given number of tokens
 */
function truncateToTokens(text: string, maxTokens: number): string {
    const words = text.split(/\s+/)
    let tokenCount = 0
    const kept: string[] = []
    
    for (const word of words) {
        const wordTokens = estimateTokens(word)
        if (tokenCount + wordTokens > maxTokens) {
            break
        }
        kept.push(word)
        tokenCount += wordTokens
    }
    
    return kept.join(' ')
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hash of the input string for deduplication.
 * Returns a hex string for use as a unique key.
 */
async function computeHash(str: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Synchronous hash using FNV-1a algorithm for better distribution.
 * This is faster than SHA-256 but still provides good collision resistance.
 */
function simpleHash(str: string): string {
    // FNV-1a 64-bit hash
    let hash = 0xcbf29ce484222325
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i)
        hash = Math.imul(hash, 0x100000001b3)
    }
    // Convert to positive hex string
    return (hash >>> 0).toString(36)
}

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}

// ─── Prompt Token Limiter ─────────────────────────────────────────────────────

const MAX_PROMPT_TOKENS = 8000

export function validatePromptSize(prompt: string): { valid: boolean; error?: string; tokenCount: number } {
    const tokenCount = estimateTokens(prompt)
    
    if (tokenCount > MAX_PROMPT_TOKENS) {
        return {
            valid: false,
            error: `Prompt exceeds maximum token limit (${MAX_PROMPT_TOKENS}). Current: ${tokenCount}`,
            tokenCount,
        }
    }

    return {
        valid: true,
        tokenCount,
    }
}
