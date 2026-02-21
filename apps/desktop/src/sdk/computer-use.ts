/**
 * computer-use.ts
 *
 * High-level SDK for interacting with the host OS — screenshots, mouse,
 * keyboard, and clipboard — backed by native Tauri commands.
 *
 * Modelled after Anthropic's computer-use API surface so modules written for
 * that API can be adapted with minimal changes.
 *
 * ## macOS permissions
 * - Mouse / keyboard: System Settings → Privacy & Security → Accessibility
 * - Screenshot: System Settings → Privacy & Security → Screen Recording
 */

import { invoke } from '@tauri-apps/api/core'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface IScreenshot {
  /** Base64 PNG data URI — use directly as `<img src="...">`. */
  readonly dataUri: string
  /** Width in physical pixels. */
  readonly width: number
  /** Height in physical pixels. */
  readonly height: number
}

export interface IScreenSize {
  readonly width: number
  readonly height: number
}

export interface IMousePosition {
  readonly x: number
  readonly y: number
}

export type MouseButton = 'left' | 'right' | 'middle'

export interface IMouseClickOptions {
  /** Absolute X position to move to before clicking. Omit to click in place. */
  x?: number
  /** Absolute Y position to move to before clicking. Omit to click in place. */
  y?: number
  /** Which button to click. Defaults to `"left"`. */
  button?: MouseButton
}

export interface IScrollOptions {
  /** X position to move to before scrolling. Omit to scroll at current position. */
  x?: number
  /** Y position to move to before scrolling. Omit to scroll at current position. */
  y?: number
  /** Horizontal scroll delta. Positive scrolls right. Defaults to 0. */
  deltaX?: number
  /** Vertical scroll delta. Positive scrolls down. Defaults to 3. */
  deltaY?: number
}

export interface IShellResult {
  exitCode: number
  stdout: string
  stderr: string
}

// ── Raw Tauri response shapes (snake_case from Rust) ──────────────────────────

interface IRawScreenshot {
  data_uri: string
  width: number
  height: number
}

interface IRawScreenSize {
  width: number
  height: number
}

interface IRawMousePosition {
  x: number
  y: number
}

interface IRawShellResult {
  exit_code: number
  stdout: string
  stderr: string
}

// ── Screenshot ─────────────────────────────────────────────────────────────────

/**
 * Captures the full primary screen.
 * Requires Screen Recording permission on macOS.
 */
export async function screenshot(): Promise<IScreenshot> {
  const raw = await invoke<IRawScreenshot>('computer_screenshot')
  return { dataUri: raw.data_uri, width: raw.width, height: raw.height }
}

/**
 * Captures a rectangular region of the primary screen.
 * Coordinates are in physical pixels, top-left origin.
 * Requires Screen Recording permission on macOS.
 */
export async function screenshotRegion(
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<IScreenshot> {
  const raw = await invoke<IRawScreenshot>('computer_screenshot_region', {
    x,
    y,
    width,
    height,
  })
  return { dataUri: raw.data_uri, width: raw.width, height: raw.height }
}

// ── Screen / cursor info ───────────────────────────────────────────────────────

/** Returns the primary screen dimensions in logical pixels. */
export async function screenSize(): Promise<IScreenSize> {
  return invoke<IRawScreenSize>('computer_screen_size')
}

/** Returns the current mouse cursor position in logical pixels. */
export async function mousePosition(): Promise<IMousePosition> {
  return invoke<IRawMousePosition>('computer_mouse_position')
}

// ── Mouse control ──────────────────────────────────────────────────────────────

/**
 * Moves the mouse cursor to an absolute screen position (logical pixels).
 * Requires Accessibility permission on macOS.
 */
export async function mouseMove(x: number, y: number): Promise<void> {
  return invoke('computer_mouse_move', { x, y })
}

/**
 * Clicks a mouse button at the current or given position.
 * Requires Accessibility permission on macOS.
 *
 * @example
 * await mouseClick({ x: 100, y: 200, button: 'left' })
 * await mouseClick()  // left-click at current position
 */
export async function mouseClick(options: IMouseClickOptions = {}): Promise<void> {
  return invoke('computer_mouse_click', {
    x: options.x ?? null,
    y: options.y ?? null,
    button: options.button ?? 'left',
  })
}

/**
 * Double-clicks the left button at the current or given position.
 * Requires Accessibility permission on macOS.
 */
export async function mouseDoubleClick(
  options: { x?: number; y?: number } = {},
): Promise<void> {
  return invoke('computer_mouse_double_click', {
    x: options.x ?? null,
    y: options.y ?? null,
  })
}

/**
 * Scrolls at the current or given position.
 * Requires Accessibility permission on macOS.
 *
 * @example
 * await mouseScroll({ deltaY: 5 })          // scroll down 5 ticks
 * await mouseScroll({ x: 400, deltaY: -3 }) // scroll up at x=400
 */
export async function mouseScroll(options: IScrollOptions = {}): Promise<void> {
  return invoke('computer_mouse_scroll', {
    x: options.x ?? null,
    y: options.y ?? null,
    delta_x: options.deltaX ?? 0,
    delta_y: options.deltaY ?? 3,
  })
}

/**
 * Drags the mouse from one position to another while holding the left button.
 * Useful for selecting text or moving UI elements.
 * Requires Accessibility permission on macOS.
 */
export async function mouseDrag(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): Promise<void> {
  return invoke('computer_mouse_drag', {
    start_x: startX,
    start_y: startY,
    end_x: endX,
    end_y: endY,
  })
}

// ── Keyboard control ───────────────────────────────────────────────────────────

/**
 * Types a string of text at the current keyboard focus.
 * Requires Accessibility permission on macOS.
 */
export async function keyType(text: string): Promise<void> {
  return invoke('computer_key_type', { text })
}

/**
 * Presses and releases a single key.
 *
 * Special key names: `"return"`, `"tab"`, `"escape"`, `"space"`, `"backspace"`,
 * `"delete"`, `"up"`, `"down"`, `"left"`, `"right"`, `"home"`, `"end"`,
 * `"pageup"`, `"pagedown"`, `"f1"`–`"f12"`, `"ctrl"`, `"alt"`, `"shift"`,
 * `"meta"` / `"cmd"` / `"command"`.
 * Single characters (`"a"`, `"1"`, `"?"`) are passed through directly.
 *
 * Requires Accessibility permission on macOS.
 */
export async function keyPress(key: string): Promise<void> {
  return invoke('computer_key_press', { key })
}

/**
 * Executes a keyboard shortcut.
 *
 * All keys except the last are held as modifiers; the last key is tapped, then
 * all modifiers are released in reverse order.
 *
 * Requires Accessibility permission on macOS.
 *
 * @example
 * await hotkey(['ctrl', 'c'])            // Copy
 * await hotkey(['ctrl', 'shift', 't'])   // Reopen tab
 * await hotkey(['meta', 'space'])        // Spotlight (macOS)
 * await hotkey(['ctrl', 'alt', 'delete'])
 */
export async function hotkey(keys: string[]): Promise<void> {
  return invoke('computer_hotkey', { keys })
}

// ── Clipboard ──────────────────────────────────────────────────────────────────

/** Returns the current clipboard text content. */
export async function clipboardGet(): Promise<string> {
  return invoke('computer_clipboard_get')
}

/** Writes text to the clipboard. */
export async function clipboardSet(text: string): Promise<void> {
  return invoke('computer_clipboard_set', { text })
}

// ── OS control ─────────────────────────────────────────────────────────────────

/**
 * Launches an application by name.
 * - macOS: `open -a <appName>`
 * - Linux: `xdg-open <appName>`
 * - Windows: `start "" "<appName>"`
 */
export async function launchApp(appName: string): Promise<void> {
  return invoke('computer_launch_app', { app_name: appName })
}

/**
 * Executes a shell command and returns its output.
 * - macOS/Linux: run via `/bin/sh -c`
 * - Windows: run via `cmd /C`
 *
 * @example
 * const result = await runShell('ls ~/Desktop')
 * console.log(result.stdout)
 */
export async function runShell(command: string): Promise<IShellResult> {
  const raw = await invoke<IRawShellResult>('computer_run_shell', { command })
  return { exitCode: raw.exit_code, stdout: raw.stdout, stderr: raw.stderr }
}

// ── File system ────────────────────────────────────────────────────────────────

/**
 * Reads the full UTF-8 content of a file.
 * Rejects files larger than 10 MB.
 */
export async function readFile(path: string): Promise<string> {
  return invoke('computer_read_file', { path })
}

/**
 * Writes UTF-8 content to a file, creating parent directories as needed.
 * Overwrites any existing content.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  return invoke('computer_write_file', { path, content })
}

/**
 * Appends UTF-8 content to a file, creating it if it does not exist.
 */
export async function appendFile(path: string, content: string): Promise<void> {
  return invoke('computer_append_file', { path, content })
}

// ── Namespace export ───────────────────────────────────────────────────────────

/**
 * Unified computer-use API.
 * Lets AI agents interact with the host OS exactly as a human would.
 *
 * @example
 * import { ComputerUse } from '@/sdk/computer-use'
 *
 * const shot = await ComputerUse.screenshot()
 * await ComputerUse.mouseClick({ x: 800, y: 400 })
 * await ComputerUse.keyType('Hello, world!')
 * await ComputerUse.hotkey(['ctrl', 'a'])
 */
export const ComputerUse = {
  // screenshot
  screenshot,
  screenshotRegion,
  // info
  screenSize,
  mousePosition,
  // mouse
  mouseMove,
  mouseClick,
  mouseDoubleClick,
  mouseScroll,
  mouseDrag,
  // keyboard
  keyType,
  keyPress,
  hotkey,
  // clipboard
  clipboardGet,
  clipboardSet,
  // OS
  launchApp,
  runShell,
  // files
  readFile,
  writeFile,
  appendFile,
} as const
