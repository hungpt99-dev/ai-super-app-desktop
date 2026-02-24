/**
 * Real-World Tool Stubs — local tools for filesystem, browser, HTTP, and OS.
 *
 * Main process only. Not accessible from renderer.
 * Each tool declares required capabilities for CapabilityGuard enforcement.
 */

import type { ToolDefinition } from '../ActingTypes.js'

export const fileReadTool: ToolDefinition = {
    name: 'file.read',
    description: 'Read contents of a file from local filesystem',
    requiredCapabilities: ['filesystem'],
    async execute(input: unknown): Promise<unknown> {
        const { path } = input as { path: string }
        const { readFile } = await import('node:fs/promises')
        const content = await readFile(path, 'utf-8')
        return { path, content, bytesRead: Buffer.byteLength(content) }
    },
}

export const fileWriteTool: ToolDefinition = {
    name: 'file.write',
    description: 'Write contents to a file on local filesystem',
    requiredCapabilities: ['filesystem'],
    async execute(input: unknown): Promise<unknown> {
        const { path, content } = input as { path: string; content: string }
        const { writeFile } = await import('node:fs/promises')
        await writeFile(path, content, 'utf-8')
        return { path, bytesWritten: Buffer.byteLength(content) }
    },
}

export const browserOpenTool: ToolDefinition = {
    name: 'browser.open',
    description: 'Open a URL in the default system browser',
    requiredCapabilities: ['browser'],
    async execute(input: unknown): Promise<unknown> {
        const { url } = input as { url: string }
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)
        await execAsync(`open "${url}"`)
        return { url, opened: true }
    },
}

export const httpFetchTool: ToolDefinition = {
    name: 'http.fetch',
    description: 'Fetch data from an HTTP endpoint',
    requiredCapabilities: ['network'],
    async execute(input: unknown): Promise<unknown> {
        const { url, method, headers, body } = input as {
            url: string
            method?: string
            headers?: Record<string, string>
            body?: string
        }
        const init: RequestInit = { method: method ?? 'GET' }
        if (headers) init.headers = headers
        if (body) init.body = body
        const response = await fetch(url, init)
        const responseBody = await response.text()
        return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseBody,
        }
    },
}

export const osExecTool: ToolDefinition = {
    name: 'os.exec',
    description: 'Execute a shell command on the local OS',
    requiredCapabilities: ['os'],
    async execute(input: unknown): Promise<unknown> {
        const { command, cwd } = input as { command: string; cwd?: string }
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)
        const result = await execAsync(command, { cwd, timeout: 30_000 })
        return {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: 0,
        }
    },
}

export const ALL_BUILTIN_TOOLS: readonly ToolDefinition[] = [
    fileReadTool,
    fileWriteTool,
    browserOpenTool,
    httpFetchTool,
    osExecTool,
]
