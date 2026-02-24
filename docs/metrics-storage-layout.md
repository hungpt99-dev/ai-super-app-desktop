# Metrics Storage Layout

## Storage Location

All metrics are persisted in the user's home directory:

```
~/.agenthub/metrics/
```

## Directory Structure

```
~/.agenthub/metrics/
├── daily/
│   ├── 2026-01-01.json
│   ├── 2026-01-02.json
│   └── ...
└── executions/
    ├── exec_000001.json
    ├── exec_000002.json
    └── ...
```

## File Formats

### Daily File (`daily/YYYY-MM-DD.json`)

```json
{
  "tokens": [
    {
      "executionId": "exec_000001",
      "workspaceId": "ws_default",
      "agentId": "agent_001",
      "phase": "planning",
      "model": "gpt-4o",
      "promptTokens": 150,
      "completionTokens": 80,
      "totalTokens": 230,
      "timestamp": 1706112000000
    }
  ],
  "tools": [
    {
      "executionId": "exec_000001",
      "workspaceId": "ws_default",
      "agentId": "agent_001",
      "toolName": "file.read",
      "durationMs": 150,
      "timestamp": 1706112000000
    }
  ]
}
```

### Execution File (`executions/executionId.json`)

```json
{
  "tokens": [...],
  "tools": [...]
}
```

## Write Strategy

### Atomic Writes

All writes use a temp file + rename pattern:

1. Write to `${path}.tmp.${timestamp}`
2. Rename to `${path}`

This ensures:
- No partial writes on crash
- No corrupted files
- Consistency on power failure

### Append Safety

Reading uses copy-on-read to avoid mutation during iteration:

```typescript
const data = await readJsonFile(filePath, fallback)
const mutable = { tokens: [...data.tokens], tools: [...data.tools] }
mutable.tokens.push(newRecord)
await atomicWriteJson(filePath, mutable)
```

## Async Only

All file operations are async to avoid blocking the event loop:

- `readFile` (not `readFileSync`)
- `writeFile` (not `writeFileSync`)
- `mkdir` with `{ recursive: true }`

## Future Remote Sync

The storage is designed for future remote aggregation:

- Daily files enable efficient date-range queries
- Execution files enable full replay
- JSON format is easily serializable for sync
- No binary blobs
- Timestamps are Unix milliseconds for timezone safety
