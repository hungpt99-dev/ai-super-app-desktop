# Execution Lifecycle

## States

```
created → validated → planned → scheduled → running → completed → snapshot_persisted
                                    ↓           ↓
                                 aborted      tool_execution → running
                                    ↓           ↓
                                    →        memory_injection → running
                                    ↓
                                  failed → snapshot_persisted
```

| State | Description |
|---|---|
| `created` | Execution context initialized |
| `validated` | Agent definition and capabilities verified |
| `planned` | Graph resolved, node execution order computed |
| `scheduled` | Placed in scheduler queue |
| `running` | Actively executing graph nodes |
| `tool_execution` | Executing a tool call (sub-state of running) |
| `memory_injection` | Injecting/retrieving memory (sub-state of running) |
| `completed` | All nodes executed successfully |
| `snapshot_persisted` | Execution snapshot saved to storage |
| `failed` | Execution failed with error |
| `aborted` | Execution cancelled by user or system |

## Valid Transitions

```typescript
const VALID_TRANSITIONS = new Map([
  ['created',             ['validated', 'failed']],
  ['validated',           ['planned', 'failed']],
  ['planned',             ['scheduled', 'failed']],
  ['scheduled',           ['running', 'aborted', 'failed']],
  ['running',             ['tool_execution', 'memory_injection', 'completed', 'failed', 'aborted']],
  ['tool_execution',      ['running', 'failed', 'aborted']],
  ['memory_injection',    ['running', 'failed', 'aborted']],
  ['completed',           ['snapshot_persisted']],
  ['snapshot_persisted',  []],
  ['failed',              ['snapshot_persisted']],
  ['aborted',             ['snapshot_persisted']],
])
```

## LifecycleStateMachine

Defined in `packages/core/src/runtime-domain/lifecycle-state-machine.ts`.

```typescript
import { LifecycleStateMachine } from '@agenthub/core'

const sm = new LifecycleStateMachine()
// sm.currentState === 'created'

sm.transition('validated')  // OK
sm.transition('running')    // throws — invalid transition from 'validated'
sm.canTransition('planned') // true
```

## Execution Events

Defined in `packages/execution/src/lifecycle/events.ts`.

| Event | Payload |
|---|---|
| `execution:created` | executionId, agentId, sessionId |
| `execution:validated` | executionId |
| `execution:planned` | executionId, graphId |
| `execution:scheduled` | executionId |
| `execution:running` | executionId, nodeId |
| `execution:tool_call` | executionId, toolName, input |
| `execution:tool_result` | executionId, toolName, output |
| `execution:memory_inject` | executionId, memoryScope |
| `execution:completed` | executionId, result |
| `execution:failed` | executionId, error |
| `execution:aborted` | executionId, reason |

## IExecutionContext

Every execution carries an `IExecutionContext` through its lifetime:

```typescript
interface IExecutionContext {
  executionId: string
  agentId: string
  sessionId: string
  graphId: string
  currentNodeId: string
  variables: Record<string, unknown>
  callStack: IAgentCallFrame[]
  memoryScope: MemoryScope
  tokenUsage: ITokenUsage
  budgetRemaining: number
  lifecycleState: ExecutionLifecycleState
}
```
