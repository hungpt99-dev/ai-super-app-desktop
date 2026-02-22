import { describe, it, expect, beforeEach } from 'vitest'
import { InternalEventBus } from './event-bus.impl.js'
import type { IEventPayload, EventType } from './event-bus.js'

function makeEvent(type: EventType, data: Record<string, unknown> = {}): IEventPayload {
    return { type, data, timestamp: new Date().toISOString() }
}

describe('InternalEventBus', () => {
    let bus: InternalEventBus

    beforeEach(() => {
        bus = new InternalEventBus()
    })

    it('delivers events to typed listeners', () => {
        const received: IEventPayload[] = []
        bus.on('execution_start', (e) => received.push(e))

        const event = makeEvent('execution_start', { agentId: 'a1' })
        bus.emit(event)

        expect(received).toHaveLength(1)
        expect(received[0]!.data).toEqual({ agentId: 'a1' })
    })

    it('does not deliver events of different types', () => {
        const received: IEventPayload[] = []
        bus.on('execution_start', (e) => received.push(e))

        bus.emit(makeEvent('execution_end'))
        expect(received).toHaveLength(0)
    })

    it('onAny receives all event types', () => {
        const received: IEventPayload[] = []
        bus.onAny((e) => received.push(e))

        bus.emit(makeEvent('execution_start'))
        bus.emit(makeEvent('tool_call'))
        bus.emit(makeEvent('execution_end'))

        expect(received).toHaveLength(3)
    })

    it('unsubscribe stops delivery', () => {
        const received: IEventPayload[] = []
        const unsub = bus.on('tool_call', (e) => received.push(e))

        bus.emit(makeEvent('tool_call'))
        expect(received).toHaveLength(1)

        unsub()
        bus.emit(makeEvent('tool_call'))
        expect(received).toHaveLength(1) // no new delivery
    })

    it('isolates handler errors — one crash does not affect others', () => {
        const results: string[] = []

        bus.on('execution_step', () => { throw new Error('boom') })
        bus.on('execution_step', () => { results.push('second') })

        // Should not throw
        bus.emit(makeEvent('execution_step'))
        expect(results).toEqual(['second'])
    })

    it('clear() removes all listeners', () => {
        const received: IEventPayload[] = []
        bus.on('tool_result', (e) => received.push(e))
        bus.onAny((e) => received.push(e))

        bus.clear()
        bus.emit(makeEvent('tool_result'))
        expect(received).toHaveLength(0)
    })

    it('listenerCount tracks total subscriptions', () => {
        expect(bus.listenerCount).toBe(0)

        bus.on('execution_start', () => { })
        bus.on('tool_call', () => { })
        bus.onAny(() => { })

        expect(bus.listenerCount).toBe(3)
    })
})
