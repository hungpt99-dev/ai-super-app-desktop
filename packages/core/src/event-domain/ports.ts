import type { IDomainEvent, DomainEventType } from './types.js'

export type DomainEventListener = (event: IDomainEvent) => void

export interface IDomainEventBus {
    emit(event: IDomainEvent): void
    on(type: DomainEventType, listener: DomainEventListener): () => void
    onAny(listener: DomainEventListener): () => void
    clear(): void
}
