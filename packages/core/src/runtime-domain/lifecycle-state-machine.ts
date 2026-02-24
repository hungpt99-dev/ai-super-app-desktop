import type { ExecutionLifecycleState, VALID_TRANSITIONS } from './types.js'
import type { ILifecycleStateMachine } from './ports.js'

export class LifecycleStateMachine implements ILifecycleStateMachine {
    private _state: ExecutionLifecycleState
    private readonly _transitions: ReadonlyMap<ExecutionLifecycleState, readonly ExecutionLifecycleState[]>

    constructor(
        initialState: ExecutionLifecycleState,
        transitions: ReadonlyMap<ExecutionLifecycleState, readonly ExecutionLifecycleState[]>
    ) {
        this._state = initialState
        this._transitions = transitions
    }

    get currentState(): ExecutionLifecycleState {
        return this._state
    }

    canTransition(to: ExecutionLifecycleState): boolean {
        const allowed = this._transitions.get(this._state)
        if (!allowed) return false
        return allowed.includes(to)
    }

    transition(to: ExecutionLifecycleState): void {
        if (!this.canTransition(to)) {
            throw new Error(`Invalid lifecycle transition: ${this._state} -> ${to}`)
        }
        this._state = to
    }
}
