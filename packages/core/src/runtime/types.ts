/**
 * Types for the runtime module — factories and handles that allow
 * the core package to create sandboxes without importing app-level code.
 */

import type { IModuleDefinition } from '@agenthub/sdk'
import type { IModuleSandboxHandle } from './module-manager.js'

/**
 * Factory for creating module sandbox handles.
 * Implemented in apps/desktop (or apps/web) to inject platform-specific
 * sandbox implementations.
 */
export interface ISandboxFactory {
    create(moduleId: string, definition: IModuleDefinition): IModuleSandboxHandle
}
