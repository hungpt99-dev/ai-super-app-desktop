/**
 * usePlanning — React hook for the Planning Engine via IPC bridge.
 *
 * No business logic. No core imports. All calls via SDK client.
 */

import { useState, useCallback } from 'react'
import type {
    IPlanningCreatePayload,
    IPlanningCreateResult,
    IPlanningMicroPayload,
    IPlanningMicroResult,
} from '@agenthub/contracts'
import { getPlanningClient } from '../../sdk/desktop/DesktopPlanningClient.js'

interface UsePlanningState {
    readonly result: IPlanningCreateResult | null
    readonly microResult: IPlanningMicroResult | null
    readonly isLoading: boolean
    readonly error: string | null
}

export function usePlanning() {
    const [state, setState] = useState<UsePlanningState>({
        result: null,
        microResult: null,
        isLoading: false,
        error: null,
    })

    const createPlan = useCallback(async (payload: IPlanningCreatePayload) => {
        setState((prev) => ({ ...prev, isLoading: true, error: null }))
        try {
            const client = getPlanningClient()
            const result = await client.create(payload)
            setState((prev) => ({ ...prev, result, isLoading: false }))
            return result
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            setState((prev) => ({ ...prev, error: message, isLoading: false }))
            return null
        }
    }, [])

    const createMicroPlan = useCallback(async (payload: IPlanningMicroPayload) => {
        setState((prev) => ({ ...prev, isLoading: true, error: null }))
        try {
            const client = getPlanningClient()
            const microResult = await client.micro(payload)
            setState((prev) => ({ ...prev, microResult, isLoading: false }))
            return microResult
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            setState((prev) => ({ ...prev, error: message, isLoading: false }))
            return null
        }
    }, [])

    const clearError = useCallback(() => {
        setState((prev) => ({ ...prev, error: null }))
    }, [])

    return {
        plan: state.result,
        microPlan: state.microResult,
        isLoading: state.isLoading,
        error: state.error,
        createPlan,
        createMicroPlan,
        clearError,
    }
}
