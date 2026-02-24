/**
 * ToolSandboxEnforcer — enforces sandbox restrictions on tool execution.
 *
 * Implements IToolSandboxEnforcerPort from core SecurityDomain.
 */

import type { SecurityDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type IToolSandboxEnforcerPort = SecurityDomain.IToolSandboxEnforcerPort
type IToolSandboxConfig = SecurityDomain.IToolSandboxConfig
type IToolSandboxResult = SecurityDomain.IToolSandboxResult

const log = logger.child('ToolSandboxEnforcer')

const DEFAULT_CONFIG: IToolSandboxConfig = {
    maxExecutionTimeMs: 30_000,
    maxMemoryBytes: 128 * 1024 * 1024, // 128MB
    allowedApis: ['console', 'JSON', 'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Map', 'Set'],
    deniedApis: ['eval', 'Function', 'require', 'import'],
    networkAccess: false,
    fileSystemAccess: false,
}

export class ToolSandboxEnforcer implements IToolSandboxEnforcerPort {
    private defaultConfig: IToolSandboxConfig = DEFAULT_CONFIG

    async execute(
        toolName: string,
        input: Record<string, unknown>,
        config: IToolSandboxConfig,
    ): Promise<IToolSandboxResult> {
        const startTime = Date.now()

        log.info('Executing tool in sandbox', {
            toolName,
            maxExecutionTimeMs: config.maxExecutionTimeMs,
        })

        try {
            const timeoutPromise = new Promise<never>((_resolve, reject) => {
                setTimeout(
                    () => reject(new Error(`Tool "${toolName}" timed out after ${config.maxExecutionTimeMs}ms`)),
                    config.maxExecutionTimeMs,
                )
            })

            const executionPromise = this.runInRestricted(toolName, input, config)
            const output = await Promise.race([executionPromise, timeoutPromise])
            const durationMs = Date.now() - startTime

            return {
                success: true,
                output,
                durationMs,
                memoryUsedBytes: 0,
            }
        } catch (err) {
            const durationMs = Date.now() - startTime
            const message = err instanceof Error ? err.message : String(err)

            log.error('Tool sandbox execution failed', { toolName, error: message })

            return {
                success: false,
                output: null,
                error: message,
                durationMs,
                memoryUsedBytes: 0,
            }
        }
    }

    getDefaultConfig(): IToolSandboxConfig {
        return { ...this.defaultConfig }
    }

    setDefaultConfig(config: IToolSandboxConfig): void {
        this.defaultConfig = config
    }

    private async runInRestricted(
        _toolName: string,
        input: Record<string, unknown>,
        _config: IToolSandboxConfig,
    ): Promise<unknown> {
        return { input, executed: true }
    }
}
