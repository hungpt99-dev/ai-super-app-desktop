import type { ITransport, IProtocolMessage, TransportStatus } from '@agenthub/core'
import { logger } from '@agenthub/shared'

const log = logger.child('WebSocketTransport')

export class WebSocketTransport implements ITransport {
    status: TransportStatus = 'disconnected'
    private socket: WebSocket | null = null
    private messageHandlers = new Set<(msg: IProtocolMessage) => void>()
    private statusHandlers = new Set<(status: TransportStatus) => void>()

    private updateStatus(newStatus: TransportStatus) {
        this.status = newStatus
        this.statusHandlers.forEach(h => h(this.status))
    }

    async connect(url: string): Promise<void> {
        this.updateStatus('connecting')
        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(url)

                this.socket.onopen = () => {
                    log.info(`Connected to remote at ${url}`)
                    this.updateStatus('connected')
                    resolve()
                }

                this.socket.onmessage = (event) => {
                    try {
                        const parsed = JSON.parse(event.data as string) as IProtocolMessage
                        this.messageHandlers.forEach(h => h(parsed))
                    } catch (e) {
                        log.warn('Failed to parse incoming WebSocket message', { error: String(e) })
                    }
                }

                this.socket.onerror = (err) => {
                    log.error('WebSocket connection error', { error: String(err) })
                    this.updateStatus('error')
                    reject(err)
                }

                this.socket.onclose = () => {
                    log.info('WebSocket connection closed')
                    this.updateStatus('disconnected')
                }
            } catch (err) {
                this.updateStatus('error')
                reject(err)
            }
        })
    }

    async disconnect(): Promise<void> {
        if (this.socket) {
            this.socket.close()
            this.socket = null
        }
    }

    async send(message: IProtocolMessage): Promise<void> {
        if (this.status !== 'connected' || !this.socket) {
            throw new Error('Cannot send message: WebSocket is not connected')
        }
        this.socket.send(JSON.stringify(message))
    }

    onMessage(handler: (message: IProtocolMessage) => void): () => void {
        this.messageHandlers.add(handler)
        return () => this.messageHandlers.delete(handler)
    }

    onStatusChange(handler: (status: TransportStatus) => void): () => void {
        this.statusHandlers.add(handler)
        return () => this.statusHandlers.delete(handler)
    }
}
