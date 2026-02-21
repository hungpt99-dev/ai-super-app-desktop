// ─── Permission Types ───────────────────────────────────────────────────────

/** All permissions a module can request. Extend this enum as the platform grows. */
export enum Permission {
  AiGenerate = 'ai.generate',
  AiStream = 'ai.stream',
  StorageLocal = 'storage.local',
  StorageRead = 'storage.read',
  StorageWrite = 'storage.write',
  UiNotify = 'ui.notify',
  UiDashboard = 'ui.dashboard',
  EventsPublish = 'events.publish',
  EventsSubscribe = 'events.subscribe',
  // ── Computer-use permissions ──────────────────────────────────────────────
  /** Capture screenshots (requires Screen Recording on macOS). */
  ComputerScreenshot = 'computer.screenshot',
  /** Control mouse and keyboard (requires Accessibility on macOS). */
  ComputerInput = 'computer.input',
  /** Read/write the system clipboard. */
  ComputerClipboard = 'computer.clipboard',
  /** Launch OS applications and run shell commands. HIGH RISK — user approval required. */
  ComputerShell = 'computer.shell',
  /** Read and write local files. HIGH RISK — user approval required. */
  ComputerFiles = 'computer.files',
  // ── Memory permissions ────────────────────────────────────────────────────
  /** Read from the local persistent memory store. */
  MemoryRead = 'memory.read',
  /** Write to (and delete from) the local persistent memory store. */
  MemoryWrite = 'memory.write',
}

// ─── AI Client ───────────────────────────────────────────────────────────────

export interface IAiGenerateRequest {
  capability: string
  input: string
  context?: Record<string, unknown>
  /**
   * Optional BYOK API key forwarded to the cloud gateway per-request.
   * Never stored server-side. Only used when the user has configured a
   * Bring-Your-Own-Key entry in Settings → API Keys.
   */
  apiKey?: string
  /** AI provider slug matching the apiKey, e.g. "openai", "anthropic". */
  provider?: string
}

export interface IAiGenerateResponse {
  output: string
  tokensUsed: number
  model: string
}

export interface IAiClient {
  generate(request: IAiGenerateRequest): Promise<IAiGenerateResponse>
  stream(request: IAiGenerateRequest): AsyncIterable<string>
}

// ─── Storage API ─────────────────────────────────────────────────────────────

export interface IStorageAPI {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  /** Returns all keys stored by this module (without namespace prefix). */
  keys(): Promise<string[]>
}

// ─── UI API ──────────────────────────────────────────────────────────────────

export interface INotifyOptions {
  title: string
  body: string
  level?: 'info' | 'success' | 'warning' | 'error'
}

export interface IUIAPI {
  showDashboard(): void
  hideDashboard(): void
  notify(options: INotifyOptions): void
}

// ─── Event Bus ───────────────────────────────────────────────────────────────

export type EventHandler<T = unknown> = (payload: T) => void

export interface IEventBus {
  publish<T>(event: string, payload: T): void
  subscribe<T>(event: string, handler: EventHandler<T>): () => void
}

// ─── Computer-use API ─────────────────────────────────────────────────────────

/** A captured screenshot encoded as a PNG data URI. */
export interface IScreenshot {
  readonly dataUri: string
  readonly width: number
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
  x?: number
  y?: number
  button?: MouseButton
}

export interface IScrollOptions {
  x?: number
  y?: number
  deltaX?: number
  deltaY?: number
}

export interface IShellResult {
  /** Exit code — 0 means success. */
  exitCode: number
  stdout: string
  stderr: string
}

// ── Agent types ────────────────────────────────────────────────────────────

/** Structured action returned by the AI during an agent loop step. */
export type IComputerAction =
  | { type: 'mouse_move'; x: number; y: number }
  | { type: 'mouse_click'; x?: number; y?: number; button?: MouseButton }
  | { type: 'mouse_double_click'; x?: number; y?: number }
  | { type: 'mouse_scroll'; x?: number; y?: number; deltaX?: number; deltaY?: number }
  | { type: 'mouse_drag'; startX: number; startY: number; endX: number; endY: number }
  | { type: 'key_type'; text: string }
  | { type: 'key_press'; key: string }
  | { type: 'hotkey'; keys: string[] }
  | { type: 'clipboard_set'; text: string }
  | { type: 'launch_app'; appName: string }
  | { type: 'run_shell'; command: string }
  | { type: 'screenshot' }
  | { type: 'wait'; ms: number }
  | { type: 'done'; result?: string }

export interface IAgentStep {
  index: number
  screenshotDataUri: string
  action: IComputerAction
  timestamp: number
}

export interface IAgentResult {
  success: boolean
  steps: IAgentStep[]
  result: string
}

export interface IComputerAgentOptions {
  /** Maximum number of action steps before giving up. Default: 20. */
  maxSteps?: number
  /** Milliseconds to wait between steps. Default: 600. */
  stepDelayMs?: number
  /**
   * AI capability to use for action decisions.
   * Must return a JSON `IComputerAction` object.
   * Default: `"computer-agent"`.
   */
  aiCapability?: string
}

/** A running computer-automation agent. */
export interface IComputerAgentRunner {
  /** Run until done or max steps reached. Calls `onStep` after each action. */
  run(onStep?: (step: IAgentStep) => void): Promise<IAgentResult>
  /** Cancel the running agent after the current step completes. */
  cancel(): void
}

/**
 * Full OS-interaction API exposed to modules via `ctx.computer`.
 *
 * Permissions are enforced per-call:
 * - `computer.screenshot` — screenshot, screenSize
 * - `computer.input` — all mouse and keyboard methods
 * - `computer.clipboard` — clipboardGet, clipboardSet
 * - `computer.shell` — launchApp, runShell
 * - `computer.files` — readFile, writeFile
 */
export interface IComputerAPI {
  // ── Screenshot (requires computer.screenshot) ───────────────────────────
  screenshot(): Promise<IScreenshot>
  screenshotRegion(x: number, y: number, width: number, height: number): Promise<IScreenshot>
  screenSize(): Promise<IScreenSize>

  // ── Mouse (requires computer.input) ─────────────────────────────────────
  mousePosition(): Promise<IMousePosition>
  mouseMove(x: number, y: number): Promise<void>
  mouseClick(options?: IMouseClickOptions): Promise<void>
  mouseDoubleClick(options?: { x?: number; y?: number }): Promise<void>
  mouseScroll(options?: IScrollOptions): Promise<void>
  mouseDrag(startX: number, startY: number, endX: number, endY: number): Promise<void>

  // ── Keyboard (requires computer.input) ──────────────────────────────────
  keyType(text: string): Promise<void>
  keyPress(key: string): Promise<void>
  hotkey(keys: string[]): Promise<void>

  // ── Clipboard (requires computer.clipboard) ──────────────────────────────
  clipboardGet(): Promise<string>
  clipboardSet(text: string): Promise<void>

  // ── OS (requires computer.shell) ─────────────────────────────────────────
  launchApp(appName: string): Promise<void>
  runShell(command: string): Promise<IShellResult>

  // ── Files (requires computer.files) ──────────────────────────────────────
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  appendFile(path: string, content: string): Promise<void>

  // ── Agent (requires computer.screenshot + computer.input) ─────────────────
  /**
   * Creates a computer-automation agent that uses AI to accomplish a goal.
   *
   * @example
   * const agent = ctx.computer.createAgent('Open Finder and navigate to Downloads')
   * await agent.run(step => console.log('Step:', step.action))
   */
  createAgent(goal: string, options?: IComputerAgentOptions): IComputerAgentRunner
}

// ─── Memory API ──────────────────────────────────────────────────────────────

export type MemoryType = 'fact' | 'preference' | 'instruction' | 'episode' | 'summary' | 'workflow'

/** A single persisted memory entry stored locally on the user's machine. */
export interface IMemoryEntry {
  readonly id: string
  readonly type: MemoryType
  readonly scope: string
  readonly title: string
  readonly content: string
  readonly source: string
  readonly accessCount: number
  readonly archived: boolean
  readonly createdAt: string
  readonly updatedAt: string
  readonly accessedAt: string | null
}

export interface IMemoryUpsertInput {
  type?: MemoryType
  /** Optional scope to namespace the memory (e.g. module id). */
  scope?: string
  /** Short human-readable key — used for deduplication. */
  title: string
  content: string
  /** Who produced this memory. Default: 'user'. */
  source?: string
}

export interface IConversationMessage {
  readonly id: string
  readonly sessionId: string
  readonly role: 'user' | 'assistant' | 'system'
  readonly content: string
  readonly createdAt: string
}

export interface IMemoryStats {
  totalMemories: number
  totalMessages: number
  byType: Partial<Record<MemoryType, number>>
}

/**
 * Local persistent memory API — reads and writes are stored on the user's
 * machine via an embedded SQLite database. Nothing is sent to any server.
 *
 * Requires `Permission.MemoryRead` to read, `Permission.MemoryWrite` to write.
 */
export interface IMemoryAPI {
  // ── Memory CRUD (write requires Permission.MemoryWrite) ──────────────────
  /**
   * Insert or update a memory entry. If a memory with the same `title`
   * already exists it is updated in place.
   */
  upsert(input: IMemoryUpsertInput): Promise<IMemoryEntry>

  /** Soft-delete a memory by ID. */
  delete(id: string): Promise<void>

  // ── Memory reads (requires Permission.MemoryRead) ─────────────────────────
  /** List active memories, optionally filtered by scope and/or type. */
  list(options?: { scope?: string; type?: MemoryType; limit?: number }): Promise<IMemoryEntry[]>

  /** Get a single memory by ID. */
  get(id: string): Promise<IMemoryEntry>

  /**
   * Build a formatted system-prompt block from the most relevant memories.
   * Intended to be prepended to AI requests to give the model context.
   * Automatically increments access counters.
   */
  buildContext(options?: { scope?: string; maxEntries?: number }): Promise<string>

  /** Return memory statistics (counts by type). */
  stats(): Promise<IMemoryStats>

  // ── Conversation history (write requires Permission.MemoryWrite) ──────────
  /**
   * Append one or more messages to a conversation session.
   * Use a stable `sessionId` (e.g. from `crypto.randomUUID()`) per chat window.
   */
  appendMessages(
    sessionId: string,
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  ): Promise<void>

  /**
   * Return the most recent `limit` messages for a session in chronological order.
   */
  getHistory(sessionId: string, limit?: number): Promise<IConversationMessage[]>

  /** Clear all messages for a session (e.g. when the user resets a chat). */
  clearSession(sessionId: string): Promise<void>
}

// ─── Module Context (injected into every module) ─────────────────────────────

export interface IModuleContext {
  readonly moduleId: string
  readonly ai: IAiClient
  readonly storage: IStorageAPI
  readonly ui: IUIAPI
  readonly events: IEventBus
  /** Full computer-use API — requires appropriate `computer.*` permissions. */
  readonly computer: IComputerAPI
  /**
   * Local persistent memory — stored on the user's machine via SQLite.
   * Requires `Permission.MemoryRead` / `Permission.MemoryWrite`.
   */
  readonly memory: IMemoryAPI
}

// ─── Tool Definition ─────────────────────────────────────────────────────────

export interface IToolInput {
  [key: string]: unknown
}

export interface ITool {
  name: string
  description: string
  inputSchema?: Record<string, unknown>
  run(input: IToolInput, ctx: IModuleContext): Promise<unknown>
}

// ─── Module Manifest ─────────────────────────────────────────────────────────

export type ModuleCategory =
  | 'finance'
  | 'productivity'
  | 'education'
  | 'developer'
  | 'creative'
  | 'utilities'

export interface IModuleManifest {
  name: string
  version: string
  minCoreVersion: string
  maxCoreVersion: string
  permissions: Permission[]
  description?: string
  author?: string
  /** Emoji or URL displayed in the module store */
  icon?: string
  category?: ModuleCategory
  tags?: string[]
  homepage?: string
}

// ─── Module Definition (defineModule result) ─────────────────────────────────

export interface IModuleDefinition {
  manifest: IModuleManifest
  tools: ITool[]
  onActivate(ctx: IModuleContext): void | Promise<void>
  onDeactivate?(ctx: IModuleContext): void | Promise<void>
}

// ─── App Package (installable bundle) ────────────────────────────────────────

export interface IAppPackage {
  manifest: IModuleManifest
  checksum: string
  signature: string
  /** Resolved absolute path to the module entry file */
  entryPath: string
}

// ─── Module Manager Interface ────────────────────────────────────────────────

export interface IModuleManager {
  install(pkg: IAppPackage): Promise<void>
  activate(moduleId: string): Promise<void>
  deactivate(moduleId: string): Promise<void>
  uninstall(moduleId: string): Promise<void>
  getActive(): ReadonlyMap<string, IModuleDefinition>
}

// ─── Permission Engine Interface ─────────────────────────────────────────────

export interface IPermissionEngine {
  grant(moduleId: string, permissions: Permission[]): void
  revoke(moduleId: string): void
  check(moduleId: string, permission: Permission): void
  hasPermission(moduleId: string, permission: Permission): boolean
}

// ─── User Plan ───────────────────────────────────────────────────────────────

export type UserPlan = 'free' | 'pro' | 'enterprise'

// ─── API Error Envelope ──────────────────────────────────────────────────────

export interface IApiError {
  code: string
  message: string
  details?: unknown
}

// ─── Usage & Subscription ────────────────────────────────────────────────────

export interface IUsageReport {
  tokensInput: number
  tokensOutput: number
  creditsDeducted: number
  model: string
  timestamp: string
}

export interface ISubscriptionInfo {
  plan: UserPlan
  tokensRemaining: number
  tokensLimit: number
  renewsAt?: string
  isActive: boolean
}
