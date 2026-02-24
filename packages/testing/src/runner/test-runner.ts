/**
 * TestRunner — executes agent test scenarios with mocked providers.
 *
 * Flow:
 *   loadAgent() → injectMockLLM() → injectMockTools() → execute() → compareOutputWithGoldenSnapshot()
 */

import { MockLLMProvider } from '../mocks/mock-llm-provider.js'
import type { IMockLLMResponse } from '../mocks/mock-llm-provider.js'
import { MockToolProvider } from '../mocks/mock-tool-provider.js'
import type { IMockToolResponse } from '../mocks/mock-tool-provider.js'
import { SnapshotComparator } from '../snapshot/snapshot-comparator.js'
import type { IGoldenSnapshot } from '../snapshot/snapshot-comparator.js'
import type { IAssertionResult } from '../assertions/assertions.js'
import { assertNoError, assertSnapshotMatch, assertTokenUsage, assertLatency } from '../assertions/assertions.js'
import { logger } from '@agenthub/shared'

const log = logger.child('TestRunner')

// ─── Test Scenario ──────────────────────────────────────────────────────────

export interface ITestScenario {
    readonly id: string
    readonly name: string
    readonly description: string
    readonly agentId: string
    readonly input: Readonly<Record<string, unknown>>
    readonly llmResponses: readonly IMockLLMResponse[]
    readonly toolResponses?: Readonly<Record<string, IMockToolResponse>>
    readonly goldenSnapshotId?: string
    readonly maxTokens?: number
    readonly maxLatencyMs?: number
}

// ─── Test Result ────────────────────────────────────────────────────────────

export interface ITestResult {
    readonly scenarioId: string
    readonly scenarioName: string
    readonly passed: boolean
    readonly diff?: string
    readonly tokenUsage: number
    readonly latency: number
    readonly assertions: readonly IAssertionResult[]
    readonly output?: unknown
    readonly error?: string
    readonly executedAt: string
}

// ─── Test Runner ────────────────────────────────────────────────────────────

export interface ITestExecutionHandler {
    execute(
        agentId: string,
        input: Record<string, unknown>,
        llmProvider: MockLLMProvider,
        toolProvider: MockToolProvider,
    ): Promise<{
        output: unknown
        tokenUsage: number
        error?: string
    }>
}

export class TestRunner {
    private readonly snapshotComparator: SnapshotComparator
    private executionHandler: ITestExecutionHandler | null = null

    constructor() {
        this.snapshotComparator = new SnapshotComparator()
    }

    setExecutionHandler(handler: ITestExecutionHandler): void {
        this.executionHandler = handler
    }

    addGoldenSnapshot(snapshot: IGoldenSnapshot): void {
        this.snapshotComparator.addGoldenSnapshot(snapshot)
    }

    async runScenario(scenario: ITestScenario): Promise<ITestResult> {
        log.info('Running test scenario', { scenarioId: scenario.id, name: scenario.name })

        if (!this.executionHandler) {
            return {
                scenarioId: scenario.id,
                scenarioName: scenario.name,
                passed: false,
                tokenUsage: 0,
                latency: 0,
                assertions: [],
                error: 'No execution handler configured',
                executedAt: new Date().toISOString(),
            }
        }

        const mockLLM = new MockLLMProvider()
        mockLLM.enqueueResponses(scenario.llmResponses)

        const mockTools = new MockToolProvider()
        if (scenario.toolResponses) {
            for (const [toolName, response] of Object.entries(scenario.toolResponses)) {
                mockTools.setToolResponse(toolName, response)
            }
        }

        const startTime = Date.now()
        const assertions: IAssertionResult[] = []

        try {
            const result = await this.executionHandler.execute(
                scenario.agentId,
                { ...scenario.input },
                mockLLM,
                mockTools,
            )

            const latency = Date.now() - startTime

            assertions.push(assertNoError('no-error', result.error))

            if (scenario.maxTokens !== undefined) {
                assertions.push(assertTokenUsage('token-budget', result.tokenUsage, scenario.maxTokens))
            }

            if (scenario.maxLatencyMs !== undefined) {
                assertions.push(assertLatency('latency', latency, scenario.maxLatencyMs))
            }

            if (scenario.goldenSnapshotId) {
                const comparison = this.snapshotComparator.compare(scenario.goldenSnapshotId, result.output)
                assertions.push(assertSnapshotMatch('snapshot-match', comparison.matched, comparison.diff))
            }

            const passed = assertions.every(a => a.passed)

            log.info('Test scenario completed', {
                scenarioId: scenario.id,
                passed,
                tokenUsage: result.tokenUsage,
                latency,
            })

            return {
                scenarioId: scenario.id,
                scenarioName: scenario.name,
                passed,
                diff: assertions.find(a => !a.passed && a.assertionName === 'snapshot-match')?.message,
                tokenUsage: result.tokenUsage,
                latency,
                assertions,
                output: result.output,
                error: result.error,
                executedAt: new Date().toISOString(),
            }
        } catch (err) {
            const latency = Date.now() - startTime
            const message = err instanceof Error ? err.message : String(err)

            log.error('Test scenario failed', { scenarioId: scenario.id, error: message })

            return {
                scenarioId: scenario.id,
                scenarioName: scenario.name,
                passed: false,
                tokenUsage: 0,
                latency,
                assertions: [assertNoError('no-error', message)],
                error: message,
                executedAt: new Date().toISOString(),
            }
        }
    }

    async runAll(scenarios: readonly ITestScenario[]): Promise<readonly ITestResult[]> {
        log.info('Running all test scenarios', { count: scenarios.length })

        const results: ITestResult[] = []

        for (const scenario of scenarios) {
            const result = await this.runScenario(scenario)
            results.push(result)
        }

        const passed = results.filter(r => r.passed).length
        const failed = results.filter(r => !r.passed).length

        log.info('All test scenarios completed', { total: results.length, passed, failed })

        return results
    }
}
