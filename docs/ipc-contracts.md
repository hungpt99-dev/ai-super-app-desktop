# IPC Contracts

## Channel Registry

All IPC communication uses typed channels defined in `@agenthub/contracts` (`desktop-ipc.ts`).

| Channel | Direction | Payload | Result |
|---|---|---|---|
| `execution:start` | renderer → main | `IExecutionStartPayload` | `IExecutionStartResult` |
| `execution:stop` | renderer → main | `IExecutionStopPayload` | `void` |
| `execution:replay` | renderer → main | `IReplayRequestDTO` | `IReplayResultDTO` |
| `execution:state` | renderer → main | `string` (executionId) | `IExecutionStateResult` |
| `execution:event` | main → renderer | — | `ExecutionStreamEvent` (streamed) |
| `agent:save` | renderer → main | `IAgentSavePayload` | `IAgentSaveResult` |
| `agent:load` | renderer → main | `string` (agentId) | `IAgentLoadResult \| null` |
| `agent:delete` | renderer → main | `string` (agentId) | `void` |
| `agent:list-local` | renderer → main | — | `ILocalAgentListItem[]` |
| `agent:validate` | renderer → main | `IAgentDefinitionDTO` | `IValidationResultDTO` |
| `skill:save` | renderer → main | `ISkillSavePayload` | `ISkillSaveResult` |
| `skill:load` | renderer → main | `string` (skillId) | `ISkillLoadResult \| null` |
| `skill:delete` | renderer → main | `string` (skillId) | `void` |
| `skill:list-local` | renderer → main | — | `ILocalSkillListItem[]` |
| `skill:validate` | renderer → main | `ISkillDefinitionDTO` | `IValidationResultDTO` |
| `snapshot:list` | renderer → main | — | `ISnapshotSummaryDTO[]` |
| `snapshot:load` | renderer → main | `string` (executionId) | `ISnapshotDTO \| null` |
| `snapshot:delete` | renderer → main | `string` (executionId) | `void` |
| `snapshot:replay` | renderer → main | `IReplayRequestDTO` | `IReplayResultDTO` |
| `version:history` | renderer → main | `string` (entityId) | `IVersionHistoryDTO \| null` |
| `version:bump` | renderer → main | `IVersionBumpPayload` | `IVersionBumpResult` |

## Execution Stream Events

The `ExecutionStreamEvent` is a discriminated union with 12 event types:

```typescript
type ExecutionStreamEvent =
  | { type: 'ExecutionCreated'; executionId: string; agentId: string; timestamp: string }
  | { type: 'ExecutionValidated'; executionId: string; timestamp: string }
  | { type: 'ExecutionPlanned'; executionId: string; nodeCount: number; timestamp: string }
  | { type: 'ExecutionScheduled'; executionId: string; timestamp: string }
  | { type: 'NodeStarted'; executionId: string; nodeId: string; nodeType: string; timestamp: string }
  | { type: 'NodeCompleted'; executionId: string; nodeId: string; result: unknown; durationMs: number; timestamp: string }
  | { type: 'ToolCalled'; executionId: string; nodeId: string; toolName: string; input: Record<string, unknown>; timestamp: string }
  | { type: 'MemoryInjected'; executionId: string; nodeId: string; memoryType: string; itemCount: number; timestamp: string }
  | { type: 'CapabilityChecked'; executionId: string; capability: string; granted: boolean; timestamp: string }
  | { type: 'ExecutionCompleted'; executionId: string; result: unknown; totalTokens: number; timestamp: string }
  | { type: 'ExecutionFailed'; executionId: string; error: string; timestamp: string }
  | { type: 'SnapshotPersisted'; executionId: string; snapshotId: string; timestamp: string }
```

## IPC Envelope

All IPC calls use the `IIPCRequest<T>` / `IIPCResponse<T>` envelope types:

```typescript
interface IIPCRequest<T = unknown> {
  channel: string
  payload: T
  requestId: string
}

interface IIPCResponse<T = unknown> {
  requestId: string
  success: boolean
  data?: T
  error?: string
}
```

## Bridge Layer

The renderer accesses IPC through `getDesktopExtendedBridge()` which returns `IDesktopExtendedBridge`:

```typescript
interface IDesktopExtendedBridge {
  execution: IDesktopExecutionBridge
  agentBuilder: IDesktopAgentBridge
  skillBuilder: IDesktopSkillBridge
  snapshot: IDesktopSnapshotBridge
  version: IDesktopVersionBridge
}
```

Each bridge section wraps Tauri `invoke()` with proper type mapping. In development without Tauri, falls back to direct handler import.
