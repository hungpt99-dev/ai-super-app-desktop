/**
 * Transport Layer — abstract transport with local implementation.
 *
 * Designed for future remote expansion (WebSocket / P2P) with zero refactoring.
 *
 * Interface: AgentTransport
 * Default implementation: LocalTransport (in-process message passing)
 * Future: RemoteTransport (WebSocket / P2P)
 */

import type { AgentMessage, AgentTransport } from '../ActingTypes.js'

export class LocalTransport implements AgentTransport {
    private readonly handlers = new Map<string, (message: AgentMessage) => Promise<AgentMessage>>()

    registerHandler(
        agentId: string,
        handler: (message: AgentMessage) => Promise<AgentMessage>,
    ): void {
        this.handlers.set(agentId, handler)
    }

    unregisterHandler(agentId: string): void {
        this.handlers.delete(agentId)
    }

    async send(message: AgentMessage): Promise<AgentMessage> {
        const handler = this.handlers.get(message.toAgent)

        if (!handler) {
            throw new Error(`No handler registered for agent: ${message.toAgent}`)
        }

        return handler(message)
    }

    getRegisteredAgents(): readonly string[] {
        return Array.from(this.handlers.keys())
    }

    clear(): void {
        this.handlers.clear()
    }
}

let _transport: LocalTransport | null = null

export function getLocalTransport(): LocalTransport {
    if (!_transport) {
        _transport = new LocalTransport()
    }
    return _transport
}
