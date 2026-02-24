import Ajv from 'ajv'
import type { IToolDefinition, IToolExecutor, IToolResult } from './index.js'
import { logger } from '@agenthub/shared'

const log = logger.child('ToolExecutor')
const ajv = new Ajv()

export class StandardToolExecutor implements IToolExecutor {
    private readonly tools = new Map<string, IToolDefinition>()

    constructor(tools: IToolDefinition[]) {
        for (const t of tools) {
            this.tools.set(t.name, t)
        }
    }

    validate(toolName: string, input: Record<string, unknown>): boolean {
        const tool = this.tools.get(toolName)
        if (!tool) return false

        const validateFn = ajv.compile(tool.inputSchema)
        const valid = validateFn(input)

        if (!valid) {
            log.warn('Tool input validation failed', { toolName, errors: validateFn.errors })
        }

        return !!valid
    }

    async execute(_toolName: string, _input: Record<string, unknown>): Promise<IToolResult> {
        // Concrete execution logic depends on the environment (Subprocess/Sandbox)
        // This is a base implementation or should be used with a strategy.
        throw new Error('Method not implemented. Use a specialized executor for Sandbox or Subprocess.')
    }
}
