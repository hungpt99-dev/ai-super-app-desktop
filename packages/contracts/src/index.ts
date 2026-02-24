/**
 * @agenthub/contracts — Cross-boundary data transfer objects and event types.
 *
 * This package contains ONLY types and interfaces — no implementations, no side effects.
 * Used for IPC messages, execution events, and serializable DTOs that cross
 * package/process boundaries (main ↔ renderer, desktop ↔ cloud).
 *
 * Dependency rule: contracts has ZERO runtime dependencies.
 * Any package may import from contracts.
 */

export * from './execution-events.js'
export * from './agent-dto.js'
export * from './skill-dto.js'
export * from './snapshot-dto.js'
export * from './ipc-messages.js'
export * from './definition-dto.js'
export * from './desktop-ipc.js'
export * from './file-storage-port.js'
export * from './platform-ipc.js'
