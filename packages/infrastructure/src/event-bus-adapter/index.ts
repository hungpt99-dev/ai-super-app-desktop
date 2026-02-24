import type { EventDomain } from '@agenthub/core'

type IDomainEventBus = EventDomain.IDomainEventBus
type DomainEventListener = EventDomain.DomainEventListener
type IDomainEvent = EventDomain.IDomainEvent
type DomainEventType = EventDomain.DomainEventType

export class EventBusAdapter implements IDomainEventBus {
    private readonly _listeners = new Map<DomainEventType, Set<DomainEventListener>>()
    private readonly _anyListeners = new Set<DomainEventListener>()

    emit(event: IDomainEvent): void {
        const typed = this._listeners.get(event.type)
        if (typed) {
            for (const listener of typed) {
                listener(event)
            }
        }
        for (const listener of this._anyListeners) {
            listener(event)
        }
    }

    on(type: DomainEventType, listener: DomainEventListener): () => void {
        let set = this._listeners.get(type)
        if (!set) {
            set = new Set()
            this._listeners.set(type, set)
        }
        set.add(listener)
        return () => {
            set!.delete(listener)
        }
    }

    onAny(listener: DomainEventListener): () => void {
        this._anyListeners.add(listener)
        return () => {
            this._anyListeners.delete(listener)
        }
    }

    clear(): void {
        this._listeners.clear()
        this._anyListeners.clear()
    }
}
