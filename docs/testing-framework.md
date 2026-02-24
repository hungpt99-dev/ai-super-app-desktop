# Testing Framework

## Overview

The Agent Test Harness provides deterministic testing of agent behavior through mock providers, snapshot comparison, and structured assertions. Designed for regression testing and CI integration.

## Architecture

```
┌──────────────────────────────────────────┐
│              TestRunner                  │
│  ┌──────────────┐  ┌─────────────────┐   │
│  │ MockProviders │  │ Assertions      │   │
│  └──────────────┘  └─────────────────┘   │
│  ┌──────────────────────────────────┐    │
│  │ SnapshotComparator               │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

## Components

### MockLLMProvider

Implements `IModelProviderPort` with:
- **Response queue** — Enqueue deterministic responses
- **Call logging** — Records all `generate()` and `generateStream()` calls
- **Stream simulation** — Breaks responses into chunks for stream testing

```typescript
import { MockLLMProvider } from '@agenthub/testing'

const mock = new MockLLMProvider()
mock.enqueueResponse({ content: 'Hello', model: 'test', tokenUsage: { prompt: 10, completion: 5 } })
const response = await mock.generate({ messages: [...], model: 'test' })
```

### MockToolProvider

- **Per-tool response queues** — Different mock responses per tool name
- **Execution logging** — Tracks which tools were called with what parameters

```typescript
import { MockToolProvider } from '@agenthub/testing'

const mock = new MockToolProvider()
mock.enqueueToolResponse('search', { results: ['a', 'b'] })
const result = await mock.executeTool('search', { query: 'test' })
```

### SnapshotComparator

Golden snapshot testing for agent outputs:
- `saveGolden(id, content)` — Save expected output
- `compare(id, actual)` — Compare against golden, returns diff

Uses line-by-line comparison for readable diffs:
```
Line 3: Expected "hello world" but got "hello universe"
```

### Assertions

Six assertion functions, each returning `IAssertionResult`:
- `assertEqual(actual, expected)` — Exact equality
- `assertContains(haystack, needle)` — Substring check
- `assertTokenUsage(actual, max)` — Token budget validation
- `assertLatency(actualMs, maxMs)` — Performance check
- `assertNoError(result)` — Error-free execution
- `assertSnapshotMatch(comparator, snapshotId, actual)` — Golden snapshot match

### TestRunner

Orchestrates test scenarios:

```typescript
import { TestRunner, MockLLMProvider, MockToolProvider } from '@agenthub/testing'

const runner = new TestRunner()
const result = await runner.run({
  id: 'test-1',
  name: 'Greeting test',
  agentId: 'greeter',
  input: { message: 'Hi' },
  expectedOutput: 'Hello!',
  mockResponses: [{ content: 'Hello!', model: 'test', tokenUsage: { prompt: 5, completion: 3 } }],
  maxTokens: 100,
  maxLatencyMs: 1000,
})

console.log(result.passed)    // boolean
console.log(result.latency)   // number (ms)
console.log(result.tokenUsage) // number
```

## Test Scenario Schema

```typescript
interface ITestScenario {
  id: string
  name: string
  agentId: string
  input: Record<string, unknown>
  expectedOutput: string
  mockResponses: MockResponse[]
  maxTokens?: number
  maxLatencyMs?: number
  snapshotId?: string
}
```

## IPC Channels

| Channel | Payload | Result |
|---------|---------|--------|
| `test:run-scenario` | `ITestRunPayload` | `ITestRunResult` |
| `test:run-all` | `ITestRunAllPayload` | `ITestRunResult` |
| `test:list-scenarios` | `string` (workspaceId) | `IScenarioEntry[]` |
| `test:get-results` | `string` (workspaceId) | `ITestRunResult` |

## Desktop UI

The **TestRunnerPage** provides:
- Scenario list with pass/fail indicators
- Run individual or all scenarios
- Result detail view with latency, token usage, diff, and error display
