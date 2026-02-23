/**
 * Platform Package — composition root.
 *
 * This is the ONLY place that instantiates runtime objects.
 * Apps call createRuntime() instead of doing `new AgentRuntime(...)`.
 *
 * See: Clean Architecture v4.1 — platform layer specification
 */

export { createRuntime } from './factory.js'
export type { IRuntimeConfig, IRuntimeBundle } from './factory.js'
export type { IDependencyContainer } from './container.js'
