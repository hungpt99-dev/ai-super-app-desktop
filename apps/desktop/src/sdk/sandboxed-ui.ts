import type { IUIAPI, INotifyOptions } from '@ai-super-app/sdk'
import { Permission } from '@ai-super-app/sdk'
import type { PermissionEngine } from '../core/permission-engine.js'
import { logger } from '@ai-super-app/shared'

const log = logger.child('SandboxedUI')

/** SandboxedUI — Proxy Pattern. Mediates all module UI interactions. */
export class SandboxedUI implements IUIAPI {
  constructor(
    private readonly moduleId: string,
    private readonly permissionEngine: PermissionEngine,
    private readonly notifyRenderer?: (options: INotifyOptions) => void,
  ) {}

  showDashboard(): void {
    this.permissionEngine.check(this.moduleId, Permission.UiDashboard)
    log.info('ui.showDashboard', { moduleId: this.moduleId })
    // Emit IPC event to renderer to show module dashboard
    // In full implementation: ipcMain.emit('ui:show-dashboard', this.moduleId)
  }

  hideDashboard(): void {
    this.permissionEngine.check(this.moduleId, Permission.UiDashboard)
    log.info('ui.hideDashboard', { moduleId: this.moduleId })
  }

  notify(options: INotifyOptions): void {
    this.permissionEngine.check(this.moduleId, Permission.UiNotify)
    log.info('ui.notify', { moduleId: this.moduleId, title: options.title })
    this.notifyRenderer?.(options)
  }
}
