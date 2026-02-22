import type { IProtocolHandler, IProtocolMessage } from '../index.js'
import { logger } from '@agenthub/shared'

const log = logger.child('ProtocolHandler')

export class ProtocolHandler implements IProtocolHandler {
    async handle(message: IProtocolMessage): Promise<IProtocolMessage | null> {
        log.info(`Received protocol action: ${message.action}`)

        switch (message.action) {
            case 'heartbeat':
                return {
                    action: 'heartbeat',
                    payload: { status: 'alive' },
                    timestamp: new Date().toISOString()
                }
            case 'start_execution':
            case 'subscribe_events':
            case 'inject_memory':
            case 'approve_checkpoint':
            case 'abort_execution':
                log.warn(`Protocol action ${message.action} is not yet fully implemented`)
                break
            default:
                log.error(`Unknown protocol action: ${message.action}`)
        }

        return null
    }
}
