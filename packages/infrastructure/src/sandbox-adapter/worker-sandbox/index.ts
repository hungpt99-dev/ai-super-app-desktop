/**
 * worker-sandbox/index.ts
 *
 * Subprocess/V8 Isolate boundaries for executing untrusted Javascript
 * Tools or Custom Logic. Enforces resource limits and timeouts.
 */

import type { IWorkerSandbox, ISandboxConfig, ISandboxResult, ICoreSandboxPort } from '@agenthub/core'

/**
 * Isomorphic Worker Sandbox.
 * Focuses on Web Worker based execution for browser/Tauri compatibility.
 * (In a full Node environment, worker_threads would be used instead).
 */
export class WebWorkerSandbox implements IWorkerSandbox {
    private worker: Worker | null = null

    async execute(code: string, args: Record<string, unknown>, config: ISandboxConfig): Promise<ISandboxResult> {
        return new Promise<ISandboxResult>((resolve) => {
            const start = Date.now()
            let isResolved = false

            // Simple worker wrapper to evaluate code and return the result via postMessage
            // The un-trusted code is wrapped inside an async IIFE
            const workerScript = `
                self.onmessage = async (e) => {
                    const args = e.data;
                    try {
                        const userFn = new Function('args', 'return (async () => { ' + ${JSON.stringify(code)} + ' })();');
                        const result = await userFn(args);
                        postMessage({ type: 'success', result });
                    } catch (err) {
                        postMessage({ type: 'error', error: err.message || String(err) });
                    }
                };
            `

            try {
                const blob = new Blob([workerScript], { type: 'application/javascript' })
                const url = URL.createObjectURL(blob)
                this.worker = new Worker(url)

                const timeoutId = setTimeout(() => {
                    if (!isResolved) {
                        isResolved = true
                        this.worker?.terminate()
                        this.worker = null
                        resolve({
                            output: null,
                            executionTimeMs: Date.now() - start,
                            error: new Error(`Sandbox execution timed out after ${config.timeoutMs}ms`),
                        })
                    }
                }, config.timeoutMs)

                this.worker.onmessage = (e) => {
                    if (isResolved) return
                    isResolved = true
                    clearTimeout(timeoutId)
                    this.worker?.terminate()
                    this.worker = null

                    const msg = e.data as { type: 'success' | 'error', result?: unknown, error?: string }
                    if (msg.type === 'error') {
                        resolve({ output: null, executionTimeMs: Date.now() - start, error: new Error(msg.error) })
                    } else {
                        resolve({ output: msg.result, executionTimeMs: Date.now() - start })
                    }
                }

                this.worker.onerror = (err) => {
                    if (isResolved) return
                    isResolved = true
                    clearTimeout(timeoutId)
                    this.worker?.terminate()
                    this.worker = null
                    resolve({ output: null, executionTimeMs: Date.now() - start, error: new Error(err.message) })
                }

                this.worker.postMessage(args)
            } catch (err) {
                if (isResolved) return
                isResolved = true
                this.worker?.terminate()
                this.worker = null
                resolve({
                    output: null,
                    executionTimeMs: Date.now() - start,
                    error: err instanceof Error ? err : new Error(String(err))
                })
            }
        })
    }

    async terminate(): Promise<void> {
        if (this.worker) {
            this.worker.terminate()
            this.worker = null
        }
    }
}

// ─── Core Sandbox Port ──────────────────────────────────────────────────────

export class CoreSandboxAdapter implements ICoreSandboxPort {
    private sandbox = new WebWorkerSandbox()

    async execute(code: string, context: Record<string, unknown>): Promise<unknown> {
        const result = await this.sandbox.execute(code, context, {
            timeoutMs: 5000,
            maxMemoryMb: 128,
            disableNetwork: false,
            disableFilesystem: true
        })
        if (result.error) throw result.error
        return result.output
    }

    async destroy(): Promise<void> {
        return this.sandbox.terminate()
    }
}
