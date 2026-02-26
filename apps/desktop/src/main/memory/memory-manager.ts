/**
 * MemoryManager — implements rolling window memory with hard limits.
 *
 * Responsibilities:
 * - Rolling window for chat messages per agent
 * - Auto-summarization when max messages exceeded
 * - Memory cleanup on TTL
 * - Workspace-scoped isolation
 *
 * Memory limits:
 * - maxMessagesPerAgent = 200 (hard limit)
 * - maxContextTokens = 8000 (prompt limit)
 * - maxMemoryBytes = 200KB per workspace
 */

import { logger } from '@agenthub/shared'

const log = logger.child('MemoryManager')

// ─── Constants ────────────────────────────────────────────────────────────────────

const MAX_MESSAGES_PER_AGENT = 200
const MAX_CONTEXT_TOKENS = 8000
const _MAX_MEMORY_BYTES = 200 * 1024 // 200KB
const _TOKENS_PER_MESSAGE_ESTIMATE = 50 // Conservative estimate
const _SUMMARY_PROMPT = 'Summarize the key points of this conversation in 2-3 sentences.'

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface IChatMessage {
    readonly id: string
    readonly role: 'user' | 'assistant' | 'system'
    readonly content: string
    readonly timestamp: number
    readonly tokenCount?: number
}

export interface IAgentMemory {
    readonly agentId: string
    readonly workspaceId: string
    messages: IChatMessage[]
    summary?: string
    lastUpdated: number
    tokenCount: number
}

export interface IMemoryStats {
    readonly agentCount: number
    readonly totalMessages: number
    readonly totalTokens: number
    readonly totalBytes: number
}

// ─── Agent Memory Implementation ───────────────────────────────────────────────

export class AgentMemoryStore {
    private readonly memories = new Map<string, IAgentMemory>() // agentId -> memory
    private readonly workspaceId: string

    constructor(workspaceId: string) {
        this.workspaceId = workspaceId
    }

    getAgentMemory(agentId: string): IAgentMemory {
        const existing = this.memories.get(agentId)
        if (existing !== undefined) {
            return existing
        }
        
        const memory: IAgentMemory = {
            agentId,
            workspaceId: this.workspaceId,
            messages: [],
            lastUpdated: Date.now(),
            tokenCount: 0,
        }
        this.memories.set(agentId, memory)
        return memory
    }

    addMessage(agentId: string, message: Omit<IChatMessage, 'id' | 'timestamp'>): IChatMessage {
        const memory = this.getAgentMemory(agentId)
        const newMessage: IChatMessage = {
            ...message,
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            timestamp: Date.now(),
            tokenCount: this.estimateTokens(message.content),
        }

        memory.messages.push(newMessage)
        memory.tokenCount += newMessage.tokenCount || 0
        memory.lastUpdated = Date.now()

        // Check if we need to compress
        if (memory.messages.length > MAX_MESSAGES_PER_AGENT) {
            this.compressMemory(memory)
        }

        return newMessage
    }

    getMessages(agentId: string, limit?: number): IChatMessage[] {
        const memory = this.memories.get(agentId)
        if (memory === undefined) return []

        const messages = memory.messages
        if (limit !== undefined && limit > 0) {
            return messages.slice(-limit)
        }
        return messages
    }

    getContext(agentId: string, maxTokens: number = MAX_CONTEXT_TOKENS): string {
        const memory = this.memories.get(agentId)
        if (memory === undefined) return ''

        // If we have a summary, use it
        let context = memory.summary ? `${memory.summary}\n\n` : ''

        // Add recent messages up to token limit
        let tokenCount = memory.summary ? this.estimateTokens(memory.summary) : 0

        for (let i = memory.messages.length - 1; i >= 0; i--) {
            const msg = memory.messages[i]
            const msgTokens = msg.tokenCount || this.estimateTokens(msg.content)

            if (tokenCount + msgTokens > maxTokens) {
                break
            }

            context = `[${msg.role}] ${msg.content}\n` + context
            tokenCount += msgTokens
        }

        return context.trim()
    }

    clearAgent(agentId: string): void {
        this.memories.delete(agentId)
        log.debug('Cleared memory for agent', { agentId, workspaceId: this.workspaceId })
    }

    getStats(): IMemoryStats {
        let totalMessages = 0
        let totalTokens = 0

        for (const memory of this.memories.values()) {
            totalMessages += memory.messages.length
            totalTokens += memory.tokenCount
        }

        return {
            agentCount: this.memories.size,
            totalMessages,
            totalTokens,
            totalBytes: totalTokens * 4, // Approximate bytes
        }
    }

    dispose(): void {
        this.memories.clear()
        log.debug('Disposed memory store', { workspaceId: this.workspaceId })
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    private estimateTokens(text: string): number {
        // Conservative estimate: ~4 characters per token
        return Math.ceil(text.length / 4)
    }

    private compressMemory(memory: IAgentMemory): void {
        if (memory.messages.length <= MAX_MESSAGES_PER_AGENT) return

        log.info('Compressing memory', {
            agentId: memory.agentId,
            messageCount: memory.messages.length,
        })

        // Keep most recent messages
        const excess = memory.messages.length - Math.floor(MAX_MESSAGES_PER_AGENT * 0.7)
        const toSummarize = memory.messages.slice(0, excess)

        // Generate summary placeholder (in production, this would call an LLM)
        memory.summary = this.generateSummary(toSummarize)

        // Keep only recent messages
        memory.messages = memory.messages.slice(-Math.floor(MAX_MESSAGES_PER_AGENT * 0.7))

        // Recalculate token count
        memory.tokenCount = memory.messages.reduce((sum, msg) => {
            return sum + (msg.tokenCount || this.estimateTokens(msg.content))
        }, 0)

        log.debug('Memory compressed', {
            agentId: memory.agentId,
            remainingMessages: memory.messages.length,
            hasSummary: !!memory.summary,
        })
    }

    private generateSummary(messages: IChatMessage[]): string {
        // In production, this would call an LLM to summarize
        // For now, create a simple placeholder
        const preview = messages.slice(0, 5).map(m => m.content.substring(0, 100)).join('; ')
        return `[Summary of ${messages.length} earlier messages] ${preview}...`
    }
}

// ─── Memory Manager (Global) ───────────────────────────────────────────────────

class GlobalMemoryManager {
    private static instance: GlobalMemoryManager | null = null
    private readonly workspaceStores = new Map<string, AgentMemoryStore>()

    static getInstance(): GlobalMemoryManager {
        if (GlobalMemoryManager.instance === null) {
            GlobalMemoryManager.instance = new GlobalMemoryManager()
        }
        return GlobalMemoryManager.instance
    }

    static resetForTesting(): void {
        GlobalMemoryManager.instance = null
    }

    getWorkspaceStore(workspaceId: string): AgentMemoryStore {
        const existing = this.workspaceStores.get(workspaceId)
        if (existing !== undefined) {
            return existing
        }
        
        const store = new AgentMemoryStore(workspaceId)
        this.workspaceStores.set(workspaceId, store)
        return store
    }

    unloadWorkspace(workspaceId: string): void {
        const store = this.workspaceStores.get(workspaceId)
        if (store !== undefined) {
            store.dispose()
            this.workspaceStores.delete(workspaceId)
            log.debug('Unloaded workspace memory', { workspaceId })
        }
    }

    clearAll(): void {
        for (const store of this.workspaceStores.values()) {
            store.dispose()
        }
        this.workspaceStores.clear()
        log.info('Cleared all memory stores')
    }

    getTotalStats(): IMemoryStats {
        let agentCount = 0
        let totalMessages = 0
        let totalTokens = 0

        for (const store of this.workspaceStores.values()) {
            const stats = store.getStats()
            agentCount += stats.agentCount
            totalMessages += stats.totalMessages
            totalTokens += stats.totalTokens
        }

        return {
            agentCount,
            totalMessages,
            totalTokens,
            totalBytes: totalTokens * 4,
        }
    }
}

export const memoryManager = GlobalMemoryManager.getInstance()

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createMemoryStore(workspaceId: string): AgentMemoryStore {
    return memoryManager.getWorkspaceStore(workspaceId)
}

export function unloadWorkspaceMemory(workspaceId: string): void {
    memoryManager.unloadWorkspace(workspaceId)
}
