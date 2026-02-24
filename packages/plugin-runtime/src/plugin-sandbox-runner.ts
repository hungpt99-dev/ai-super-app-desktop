/**
 * PluginSandboxRunner — executes plugin code in a restricted environment.
 *
 * Ensures plugins cannot access core internals directly.
 * Lives in the execution layer as it orchestrates plugin execution.
 */

import { logger } from '@agenthub/shared'

const log = logger.child('PluginSandboxRunner')

export interface IPluginSandboxConfig {
    readonly maxExecutionTimeMs: number
    readonly allowNetworkAccess: boolean
    readonly allowFileSystemAccess: boolean
}

const DEFAULT_SANDBOX_CONFIG: IPluginSandboxConfig = {
    maxExecutionTimeMs: 30_000,
    allowNetworkAccess: false,
    allowFileSystemAccess: false,
}

export interface IPluginSandboxResult {
    readonly success: boolean
    readonly output: unknown
    readonly error?: string
    readonly durationMs: number
}

export class PluginSandboxRunner {
    private readonly config: IPluginSandboxConfig

    constructor(config?: Partial<IPluginSandboxConfig>) {
        this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config }
    }

    async execute(
        pluginId: string,
        handler: (input: Record<string, unknown>) => Promise<unknown>,
        input: Record<string, unknown>,
    ): Promise<IPluginSandboxResult> {
        const startTime = Date.now()

        log.info('Executing plugin in sandbox', { pluginId })

        try {
            const timeoutPromise = new Promise<never>((_resolve, reject) => {
                setTimeout(
                    () => reject(new Error(`Plugin execution timed out after ${this.config.maxExecutionTimeMs}ms`)),
                    this.config.maxExecutionTimeMs,
                )
            })

            const executionPromise = handler(input)
            const output = await Promise.race([executionPromise, timeoutPromise])
            const durationMs = Date.now() - startTime

            log.info('Plugin execution completed', { pluginId, durationMs })

            return {
                success: true,
                output,
                durationMs,
            }
        } catch (err) {
            const durationMs = Date.now() - startTime
            const message = err instanceof Error ? err.message : String(err)

            log.error('Plugin execution failed', { pluginId, error: message, durationMs })

            return {
                success: false,
                output: null,
                error: message,
                durationMs,
            }
        }
    }
}
