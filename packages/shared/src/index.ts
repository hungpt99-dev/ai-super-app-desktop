/**
 * @agenthub/shared — Layer 1
 *
 * Types, DTO, Zod schemas, constants.
 * No business logic. No side-effects.
 *
 * See: docs/codebase.md Layer 1 — shared
 */

// ── Types ───────────────────────────────────────────────────────────────────
export * from './types/index.js'
export * from './types/errors.js'
export { logger, setLogLevel, getLogLevel } from './types/logger.js'
export type { ILogger, ILogEntry, LogLevel } from './types/logger.js'
export { isSemverCompatible } from './types/utils.js'

// ── DTO ─────────────────────────────────────────────────────────────────────
export * from './dto/index.js'

// ── Schemas ─────────────────────────────────────────────────────────────────
export * from './schemas/index.js'
