/**
 * useActing — React hook for the Acting Engine via IPC bridge.
 *
 * No business logic. No core imports. All calls via SDK client.
 */

import { useState, useCallback } from 'react'
import type {
    IActingExecuteStepPayload,
    IActingExecuteStepResult,
    IActingExecuteMicroPayload,
    IActingExecuteMicroResult,
} from '@agenthub/contracts'
import { getActingClient } from '../../sdk/desktop/DesktopActingClient.js'

interface UseActingState {
    readonly stepResult: IActingExecuteStepResult | null
    readonly microResult: IActingExecuteMicroResult | null
    readonly isExecuting: boolean
    readonly error: string | null
}

export function useActing() {
    const [state, setState] = useState<UseActingState>({
        stepResult: null,
        microResult: null,
        isExecuting: false,
        error: null,
    })

    const executeStep = useCallback(async (payload: IActingExecuteStepPayload) => {
        setState((prev) => ({ ...prev, isExecuting: true, error: null }))
        try {
            const client = getActingClient()
            const stepResult = await client.executeStep(payload)
            setState((prev) => ({ ...prev, stepResult, isExecuting: false }))
            return stepResult
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            setState((prev) => ({ ...prev, error: message, isExecuting: false }))
            return null
        }
    }, [])

    const executeMicro = useCallback(async (payload: IActingExecuteMicroPayload) => {
        setState((prev) => ({ ...prev, isExecuting: true, error: null }))
        try {
            const client = getActingClient()
            const microResult = await client.executeMicro(payload)
            setState((prev) => ({ ...prev, microResult, isExecuting: false }))
            return microResult
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            setState((prev) => ({ ...prev, error: message, isExecuting: false }))
            return null
        }
    }, [])

    const clearError = useCallback(() => {
        setState((prev) => ({ ...prev, error: null }))
    }, [])

    return {
        stepResult: state.stepResult,
        microResult: state.microResult,
        isExecuting: state.isExecuting,
        error: state.error,
        executeStep,
        executeMicro,
        clearError,
    }
}
