/**
 * sandboxed-computer.ts
 *
 * Permission-enforced proxy around all computer-use operations.
 * Modules receive this instance as `ctx.computer` — they can only call methods
 * they have the corresponding `computer.*` permission for.
 *
 * Permission mapping:
 * - screenshot, screenshotRegion, screenSize → Permission.ComputerScreenshot
 * - mousePosition, mouseMove, mouseClick, ... keyType, keyPress, hotkey → Permission.ComputerInput
 * - clipboardGet, clipboardSet → Permission.ComputerClipboard
 * - launchApp, runShell → Permission.ComputerShell
 * - readFile, writeFile, appendFile → Permission.ComputerFiles
 * - createAgent → Permission.ComputerScreenshot + Permission.ComputerInput
 */

import type {
  IComputerAPI,
  IComputerAgentOptions,
  IComputerAgentRunner,
  IMouseClickOptions,
  IMousePosition,
  IScreenSize,
  IScreenshot,
  IScrollOptions,
  IShellResult,
  IAiClient,
} from '@agenthub/sdk'
import { Permission } from '@agenthub/sdk'
import type { PermissionEngine } from '@agenthub/core'
import { ComputerAgent } from './computer-agent.js'
import * as CU from './computer-use.js'
import { logger } from '@agenthub/shared'

const log = logger.child('SandboxedComputer')

export class SandboxedComputer implements IComputerAPI {
  constructor(
    private readonly moduleId: string,
    private readonly permissionEngine: PermissionEngine,
    private readonly ai: IAiClient,
  ) { }

  // ── Screenshot ─────────────────────────────────────────────────────────────

  async screenshot(): Promise<IScreenshot> {
    this.check(Permission.ComputerScreenshot)
    log.debug('computer.screenshot', { moduleId: this.moduleId })
    return CU.screenshot()
  }

  async screenshotRegion(
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<IScreenshot> {
    this.check(Permission.ComputerScreenshot)
    return CU.screenshotRegion(x, y, width, height)
  }

  async screenSize(): Promise<IScreenSize> {
    this.check(Permission.ComputerScreenshot)
    return CU.screenSize()
  }

  // ── Mouse ──────────────────────────────────────────────────────────────────

  async mousePosition(): Promise<IMousePosition> {
    this.check(Permission.ComputerInput)
    return CU.mousePosition()
  }

  async mouseMove(x: number, y: number): Promise<void> {
    this.check(Permission.ComputerInput)
    return CU.mouseMove(x, y)
  }

  async mouseClick(options?: IMouseClickOptions): Promise<void> {
    this.check(Permission.ComputerInput)
    return CU.mouseClick(options)
  }

  async mouseDoubleClick(options?: { x?: number; y?: number }): Promise<void> {
    this.check(Permission.ComputerInput)
    return CU.mouseDoubleClick(options)
  }

  async mouseScroll(options?: IScrollOptions): Promise<void> {
    this.check(Permission.ComputerInput)
    return CU.mouseScroll(options)
  }

  async mouseDrag(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): Promise<void> {
    this.check(Permission.ComputerInput)
    return CU.mouseDrag(startX, startY, endX, endY)
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  async keyType(text: string): Promise<void> {
    this.check(Permission.ComputerInput)
    return CU.keyType(text)
  }

  async keyPress(key: string): Promise<void> {
    this.check(Permission.ComputerInput)
    return CU.keyPress(key)
  }

  async hotkey(keys: string[]): Promise<void> {
    this.check(Permission.ComputerInput)
    return CU.hotkey(keys)
  }

  // ── Clipboard ──────────────────────────────────────────────────────────────

  async clipboardGet(): Promise<string> {
    this.check(Permission.ComputerClipboard)
    return CU.clipboardGet()
  }

  async clipboardSet(text: string): Promise<void> {
    this.check(Permission.ComputerClipboard)
    return CU.clipboardSet(text)
  }

  // ── OS ─────────────────────────────────────────────────────────────────────

  async launchApp(appName: string): Promise<void> {
    this.check(Permission.ComputerShell)
    log.info('computer.launchApp', { moduleId: this.moduleId, appName })
    return CU.launchApp(appName)
  }

  async runShell(command: string): Promise<IShellResult> {
    this.check(Permission.ComputerShell)
    log.info('computer.runShell', { moduleId: this.moduleId, command })
    return CU.runShell(command)
  }

  // ── Files ──────────────────────────────────────────────────────────────────

  async readFile(path: string): Promise<string> {
    this.check(Permission.ComputerFiles)
    return CU.readFile(path)
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.check(Permission.ComputerFiles)
    log.info('computer.writeFile', { moduleId: this.moduleId, path })
    return CU.writeFile(path, content)
  }

  async appendFile(path: string, content: string): Promise<void> {
    this.check(Permission.ComputerFiles)
    return CU.appendFile(path, content)
  }

  // ── Agent ──────────────────────────────────────────────────────────────────

  createAgent(goal: string, options?: IComputerAgentOptions): IComputerAgentRunner {
    this.check(Permission.ComputerScreenshot)
    this.check(Permission.ComputerInput)
    log.info('computer.createAgent', { moduleId: this.moduleId, goal })
    return new ComputerAgent(goal, this.ai, this, options)
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private check(permission: Permission): void {
    this.permissionEngine.check(this.moduleId, permission)
  }
}
