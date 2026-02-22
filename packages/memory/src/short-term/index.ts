/**
 * short-term/index.ts
 *
 * Working memory (context window) and Session memory (execution history).
 */

import type { IAgentMessage } from '@agenthub/core'

/**
 * Represents the immediate context window and agent scratchpad for
 * the current active execution graph.
 */
export interface IWorkingMemory {
    /** Retrieve the rolling conversation history. */
    getConversationHistory(): IAgentMessage[]
    /** Append a new message to the current context. */
    appendMessage(msg: IAgentMessage): void
    /** Summarize and truncate the window if token limits are exceeded. */
    compact(maxTokens: number): Promise<void>
}

/**
 * Ephemeral session storage that survives a single UI session but isn't
 * semantically indexed like long-term memory.
 */
export interface ISessionMemory {
    sessionId: string
    agentId: string
    get(key: string): unknown
    set(key: string, value: unknown): void
    clear(): void
}
