import type { ToolAdapter } from '../interface.js'
import type { IWorkerSandbox } from '@agenthub/core'

/**
 * Custom JS Tool Adapter
 * Takes an IWorkerSandbox in its constructor to execute the provided payload.
 */
export class CustomJsToolAdapter implements ToolAdapter {
    readonly name = 'CUSTOM_JS'
    readonly description = 'Executes custom un-trusted javascript logic'
    readonly inputSchema = {
        type: 'object',
        properties: {
            code: { type: 'string', description: 'Javascript code to execute' },
            args: { type: 'object', description: 'Arguments passed into the code' }
        },
        required: ['code']
    }

    constructor(private readonly sandbox: IWorkerSandbox) { }

    async execute(input: Record<string, unknown>): Promise<unknown> {
        const code = input.code as string
        const args = (input.args as Record<string, unknown>) || {}

        if (!code) throw new Error('Missing code parameter')

        const result = await this.sandbox.execute(code, args, {
            timeoutMs: 5000,
            maxMemoryMb: 64,
            disableNetwork: false,
            disableFilesystem: true
        })

        if (result.error) {
            throw result.error
        }

        return result.output
    }
}

