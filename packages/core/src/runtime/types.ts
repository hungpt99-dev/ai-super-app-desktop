/**
 * Types for the runtime module — factories and handles that allow
 * the core package to create sandboxes without importing app-level code.
 *
 * NOTE: ISandboxFactory is now defined as ISandboxFactoryPort in interfaces.ts.
 * This file re-exports it for backward compatibility.
 */

export type { ISandboxFactoryPort as ISandboxFactory } from './interfaces.js'
