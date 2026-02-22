import type { ToolAdapter } from '../interface.js'
import * as fs from 'fs/promises'
import * as path from 'path'

export class FileReaderToolAdapter implements ToolAdapter {
    readonly name = 'FILE_READ'
    readonly description = 'Read contents from a file'
    readonly inputSchema = {
        type: 'object',
        properties: {
            filePath: { type: 'string', description: 'Path to the file to read' }
        },
        required: ['filePath']
    }

    async execute(input: Record<string, unknown>): Promise<unknown> {
        const filePath = input.filePath as string
        if (!filePath) throw new Error('Missing filePath parameter')
        return await fs.readFile(path.resolve(filePath), 'utf-8')
    }
}

export class FileWriterToolAdapter implements ToolAdapter {
    readonly name = 'FILE_WRITE'
    readonly description = 'Write contents to a file'
    readonly inputSchema = {
        type: 'object',
        properties: {
            filePath: { type: 'string', description: 'Path to the file to write' },
            contents: { type: 'string', description: 'Contents to write into the file' }
        },
        required: ['filePath', 'contents']
    }

    async execute(input: Record<string, unknown>): Promise<unknown> {
        const filePath = input.filePath as string
        const contents = input.contents as string
        if (!filePath || typeof contents !== 'string') {
            throw new Error('Missing filePath or contents parameters')
        }
        await fs.writeFile(path.resolve(filePath), contents, 'utf-8')
        return { success: true, filePath }
    }
}

