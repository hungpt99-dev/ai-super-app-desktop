/**
 * Worker Manager — dispatches and manages agent execution jobs.
 *
 * Uses locally defined types — NO @agenthub/core import.
 */

import type { IExecutionLifecycle } from '../lifecycle/index.js'
import { logger } from '@agenthub/shared'

const log = logger.child('WorkerManager')

export interface IWorkerJob {
    executionId: string
    agentId: string
    input: Record<string, unknown>
    config: Record<string, unknown>
}

export interface IWorkerResult {
    executionId: string
    success: boolean
    finalState?: Record<string, unknown>
    error?: Error
}

export interface IWorkerManagerPort {
    dispatch(job: IWorkerJob, lifecycle: IExecutionLifecycle): Promise<IWorkerResult>
    terminate(executionId: string): Promise<void>
    getStats(): { activeWorkers: number; queuedJobs: number; capacity: number }
}

/**
 * In-memory WorkerManager.
 * Runs agent graphs asynchronously in the same Node/Renderer process.
 * Real production implementation would use worker_threads or isolated v8 contexts.
 */
export class WorkerManager implements IWorkerManagerPort {
    private readonly capacity: number = 4
    private activeExecutionIds = new Set<string>()

    async dispatch(job: IWorkerJob, lifecycle: IExecutionLifecycle): Promise<IWorkerResult> {
        if (this.activeExecutionIds.size >= this.capacity) {
            log.warn(`WorkerManager capacity reached. Queuing not fully implemented, failing job for ${job.executionId}`)
            return {
                executionId: job.executionId,
                success: false,
                error: new Error('WorkerManager at maximum capacity')
            }
        }

        this.activeExecutionIds.add(job.executionId)

        try {
            log.info(`Starting execution job ${job.executionId} in WorkerManager`)

            // Wait for abort signal if triggered during execution
            lifecycle.signal.addEventListener('abort', () => {
                log.info(`Execution job ${job.executionId} aborted`)
                this.terminate(job.executionId)
            })

            // Here, we would actual call the AgentRuntime 'glue' to run the scheduler
            // For now, this is just simulating execution time
            await new Promise((resolve) => setTimeout(resolve, 500))

            return {
                executionId: job.executionId,
                success: !lifecycle.signal.aborted
            }
        } catch (error) {
            log.error(`Execution job ${job.executionId} failed`, { error })
            return {
                executionId: job.executionId,
                success: false,
                error: error as Error
            }
        } finally {
            this.activeExecutionIds.delete(job.executionId)
        }
    }

    async terminate(executionId: string): Promise<void> {
        if (this.activeExecutionIds.has(executionId)) {
            log.info(`Terminating execution ${executionId} from WorkerManager`)
            this.activeExecutionIds.delete(executionId)
        }
    }

    getStats() {
        return {
            activeWorkers: this.activeExecutionIds.size,
            queuedJobs: 0,
            capacity: this.capacity
        }
    }
}
