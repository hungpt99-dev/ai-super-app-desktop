import type { IModuleContext, IModuleDefinition, INotifyOptions } from '@agenthub/sdk'
import type { PermissionEngine } from './permission-engine.js'
import { SandboxedAiClient } from '../sdk/sandboxed-ai-client.js'
import { SandboxedStorage } from '../sdk/sandboxed-storage.js'
import { SandboxedUI } from '../sdk/sandboxed-ui.js'
import { SandboxedEventBus } from '../sdk/sandboxed-event-bus.js'
import { SandboxedComputer } from '../sdk/sandboxed-computer.js'
import { SandboxedMemory } from '../sdk/sandboxed-memory.js'
import { SandboxedHttp } from '../sdk/sandboxed-http.js'
import { SandboxedLogger } from '../sdk/sandboxed-logger.js'
import { logger } from '@agenthub/shared'

const log = logger.child('ModuleSandbox')

/**
 * ModuleSandbox — Proxy Pattern.
 *
 * Constructs the sandboxed IModuleContext and manages the module lifecycle.
 * Every SDK call is mediated through a sandboxed proxy that enforces permissions
 * before delegating to real implementations.
 */
export class ModuleSandbox {
  private ctx: IModuleContext | null = null

  constructor(
    private readonly moduleId: string,
    private readonly definition: IModuleDefinition,
    private readonly permissionEngine: PermissionEngine,
    private readonly notifyRenderer?: (options: INotifyOptions) => void,
  ) {}

  async activate(): Promise<void> {
    this.ctx = this.buildContext()
    await this.definition.onActivate(this.ctx)
    log.info('Sandbox activated', { moduleId: this.moduleId })
  }

  async deactivate(): Promise<void> {
    if (this.ctx && this.definition.onDeactivate) {
      await this.definition.onDeactivate(this.ctx)
    }
    this.ctx = null
    log.info('Sandbox deactivated', { moduleId: this.moduleId })
  }

  /** Expose the sandboxed context for direct tool invocation via IPC. */
  getCtx(): IModuleContext | null {
    return this.ctx
  }

  private buildContext(): IModuleContext {
    const { moduleId, permissionEngine, notifyRenderer } = this

    const ai = new SandboxedAiClient(moduleId, permissionEngine)

    return {
      moduleId,
      ai,
      storage: new SandboxedStorage(moduleId, permissionEngine),
      ui: new SandboxedUI(moduleId, permissionEngine, notifyRenderer),
      events: new SandboxedEventBus(moduleId, permissionEngine),
      computer: new SandboxedComputer(moduleId, permissionEngine, ai),
      memory: new SandboxedMemory(moduleId, permissionEngine),
      http: new SandboxedHttp(moduleId, permissionEngine),
      log: new SandboxedLogger(moduleId),
    }
  }
}
