/**
 * SDK Authoring — agent definition, DSL, builders.
 *
 * This sub-module is for module authors who build agents.
 * It provides defineModule() and related authoring APIs.
 */

export { defineModule } from '../define-module.js'
export type { IDefineModuleOptions } from '../define-module.js'
export type {
    IModuleManifest,
    IModuleDefinition,
    IModuleContext,
    IToolInput,
    ITool,
    Permission,
    ModuleCategory,
    IAppPackage,
} from '../types.js'
