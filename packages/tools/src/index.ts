/**
 * Tools Package — tool registry, executor, and schema validation.
 *
 * Tool execution always goes through the sandbox layer.
 * Never call a tool directly from runtime.
 *
 * See: docs/technical-design.md §6 TOOL SYSTEM
 * See: docs/codebase.md Sandbox Rule
 */

// ─── Tool Schema ────────────────────────────────────────────────────────────

export interface IToolDefinition {
    readonly name: string
    readonly description: string
    readonly inputSchema: Record<string, unknown>
    /** Maximum execution time in milliseconds. Default: 10000. */
    readonly timeoutMs?: number
}

// ─── Tool Execution Result ──────────────────────────────────────────────────

export interface IToolResult {
    readonly success: boolean
    readonly output: unknown
    readonly error?: string
    readonly durationMs: number
}

// ─── Tool Registry ──────────────────────────────────────────────────────────

export interface IToolRegistry {
    /** Register a tool definition. Throws if name is already registered. */
    register(tool: IToolDefinition): void
    /** Get a tool by name. Returns null if not found. */
    get(name: string): IToolDefinition | null
    /** List all registered tool names. */
    list(): string[]
    /** Check if a tool is registered. */
    has(name: string): boolean
}

// ─── Tool Executor ──────────────────────────────────────────────────────────

/**
 * Tool execution flow (from technical design §6.2):
 * 1. Provider returns tool_call
 * 2. Validate against schema
 * 3. Execute with isolation (timeout + resource limits)
 * 4. Return result to graph
 */
export interface IToolExecutor {
    /** Validate tool input against its JSON Schema. */
    validate(toolName: string, input: Record<string, unknown>): boolean
    /** Execute a tool with timeout enforcement and optional subprocess isolation. */
    execute(toolName: string, input: Record<string, unknown>): Promise<IToolResult>
}

// ─── Re-export concrete implementation ──────────────────────────────────────

export { ToolRegistry } from './tool-registry.js'
export { StandardToolExecutor } from './tool-executor.js'
export * from './interface.js'
export * from './http/index.js'
export * from './file/index.js'
export * from './custom-js/index.js'
