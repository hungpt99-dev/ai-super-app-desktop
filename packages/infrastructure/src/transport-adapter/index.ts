import type { RuntimeDomain } from '@agenthub/core'
import { logger } from '@agenthub/shared'

type ITransportPort = RuntimeDomain.ITransportPort

export type TransportStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export class TransportAdapter implements ITransportPort {
    private _status: TransportStatus = 'disconnected'
    private _socket: WebSocket | null = null
    private readonly _messageHandlers: Array<(data: unknown) => void> = []
    private readonly _statusHandlers: Array<(status: TransportStatus) => void> = []

    get status(): TransportStatus {
        return this._status
    }

    async connect(url: string): Promise<void> {
        this._updateStatus('connecting')
        return new Promise((resolve, reject) => {
            try {
                this._socket = new WebSocket(url)
                this._socket.onopen = () => {
                    this._updateStatus('connected')
                    resolve()
                }
                this._socket.onerror = () => {
                    this._updateStatus('error')
                    reject(new Error(`WebSocket connection failed: ${url}`))
                }
                this._socket.onmessage = (event) => {
                    const data: unknown = JSON.parse(String(event.data))
                    for (const handler of this._messageHandlers) {
                        handler(data)
                    }
                }
                this._socket.onclose = () => {
                    this._updateStatus('disconnected')
                }
            } catch (err) {
                this._updateStatus('error')
                reject(err)
            }
        })
    }

    async disconnect(): Promise<void> {
        if (this._socket) {
            this._socket.close()
            this._socket = null
        }
        this._updateStatus('disconnected')
    }

    async send(message: Readonly<Record<string, unknown>>): Promise<void> {
        if (!this._socket || this._status !== 'connected') {
            throw new Error('Transport not connected')
        }
        this._socket.send(JSON.stringify(message))
    }

    onMessage(handler: (data: unknown) => void): () => void {
        this._messageHandlers.push(handler)
        return () => {
            const idx = this._messageHandlers.indexOf(handler)
            if (idx >= 0) this._messageHandlers.splice(idx, 1)
        }
    }

    onStatusChange(handler: (status: TransportStatus) => void): () => void {
        this._statusHandlers.push(handler)
        return () => {
            const idx = this._statusHandlers.indexOf(handler)
            if (idx >= 0) this._statusHandlers.splice(idx, 1)
        }
    }

    private _updateStatus(status: TransportStatus): void {
        this._status = status
        logger.info(`Transport status: ${status}`)
        for (const handler of this._statusHandlers) {
            handler(status)
        }
    }
}
