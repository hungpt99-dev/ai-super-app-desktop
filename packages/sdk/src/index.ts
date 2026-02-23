/**
 * @agenthub/sdk — public API for module authors and app developers.
 *
 * Sub-modules:
 * - authoring: defineModule(), DSL builders, manifest types
 * - client: runtime invocation, streaming, control APIs
 *
 * Backward-compatible: all types still available from root export.
 */

// Full backward-compatible export
export * from './types.js'
export * from './define-module.js'

// Sub-module re-exports
export * as authoring from './authoring/index.js'
export * as client from './client/index.js'
