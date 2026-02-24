import type { RuntimeDomain } from '@agenthub/core'

type ISandboxPort = RuntimeDomain.ISandboxPort

export class SandboxAdapter implements ISandboxPort {
    private _destroyed = false

    async execute(code: string, context: Readonly<Record<string, unknown>>): Promise<unknown> {
        if (this._destroyed) {
            throw new Error('Sandbox has been destroyed')
        }
        const fn = new Function('context', code)
        return fn(context)
    }

    async destroy(): Promise<void> {
        this._destroyed = true
    }
}
export * from './permission/index.js'
export * from './worker-sandbox/index.js'
