import type { ToolAdapter } from '../interface.js'

export class HttpFetchToolAdapter implements ToolAdapter {
    readonly name = 'HTTP_FETCH'
    readonly description = 'Make an HTTP request to an external URL'
    readonly inputSchema = {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'The absolute URL to request' },
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
            headers: { type: 'object', additionalProperties: { type: 'string' } },
            body: { type: 'string' }
        },
        required: ['url']
    }

    async execute(input: Record<string, unknown>): Promise<unknown> {
        const url = input.url as string
        if (!url) throw new Error('Missing URL parameter')

        const method = (input.method as string) || 'GET'
        const headers = (input.headers as Record<string, string>) || {}
        const body = input.body as string | undefined

        const options: RequestInit = { method, headers }
        if (body) {
            options.body = body
        }

        const res = await fetch(url, options)
        if (!res.ok) {
            throw new Error(`HTTP Error: ${res.status} ${res.statusText}`)
        }

        const responseText = await res.text()
        try {
            return JSON.parse(responseText)
        } catch {
            return responseText
        }
    }
}

