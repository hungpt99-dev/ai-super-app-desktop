import type { IModuleDefinition, IModuleManifest, ITool, Permission } from './types.js'

export interface IDefineModuleOptions {
  manifest: IModuleManifest
  tools?: ITool[]
  permissions?: Permission[]
  onActivate: IModuleDefinition['onActivate']
  onDeactivate?: IModuleDefinition['onDeactivate']
}

/**
 * Factory function for declaring a module.
 * All modules MUST use this API — never export raw objects.
 */
export function defineModule(options: IDefineModuleOptions): IModuleDefinition {
  return {
    manifest: {
      ...options.manifest,
      permissions: options.permissions ?? options.manifest.permissions,
    },
    tools: options.tools ?? [],
    onActivate: options.onActivate,
    ...(options.onDeactivate !== undefined && { onDeactivate: options.onDeactivate }),
  }
}
