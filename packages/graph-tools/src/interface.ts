/**
 * ToolAdapter — the interface for tool execution.
 *
 * Convention: Interface = `XxxAdapter`.
 * See: docs/codebase.md Naming Convention & Sandbox Rule
 */

export interface ToolAdapter {
    readonly name: string
    readonly description: string
    readonly inputSchema: Record<string, unknown>
    execute(input: Record<string, unknown>): Promise<unknown>
}
