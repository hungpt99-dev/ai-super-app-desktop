# Local Storage Layout

## Base Directory

All AgentHub data is stored under:

```
~/.agenthub/
```

(Resolved via `os.homedir()` + `path.join`)

## Directory Structure

```
~/.agenthub/
├── agents/                    # Agent definitions
│   ├── {agent-id}.json        # Current version of each agent
│   └── ...
├── skills/                    # Skill definitions
│   ├── {skill-id}.json        # Current version of each skill
│   └── ...
├── snapshots/                 # Execution snapshots
│   ├── {execution-id}.json    # Snapshot data for each execution
│   └── ...
├── versions/                  # Version history
│   ├── {entity-id}.json       # Version history for each agent/skill
│   ├── agents/                # Versioned copies of agents
│   │   └── {agent-id}/
│   │       ├── 1.0.0.json
│   │       ├── 1.0.1.json
│   │       └── 1.1.0.json
│   └── skills/                # Versioned copies of skills
│       └── {skill-id}/
│           ├── 1.0.0.json
│           ├── 1.0.1.json
│           └── 1.1.0.json
└── events/                    # (Future) Event log storage
```

## File Formats

### Agent Definition (`agents/{id}.json`)
```json
{
  "id": "uuid",
  "name": "My Agent",
  "version": "1.2.0",
  "description": "...",
  "capabilities": ["tool_use", "memory_read"],
  "permissions": ["tool_use", "memory_read"],
  "memoryConfig": {
    "enabled": true,
    "scopes": ["working", "session"]
  },
  "tools": [
    { "name": "search", "description": "...", "inputSchema": {} }
  ],
  "skills": [],
  "model": "gpt-4",
  "maxTokenBudget": 100000,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Skill Definition (`skills/{id}.json`)
```json
{
  "id": "uuid",
  "name": "My Skill",
  "version": "1.0.0",
  "description": "...",
  "type": "llm_prompt",
  "capabilities": ["network_access"],
  "inputSchema": {},
  "outputSchema": {},
  "model": "gpt-4",
  "temperature": 0.7,
  "systemPrompt": "...",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Snapshot (`snapshots/{executionId}.json`)
```json
{
  "executionId": "uuid",
  "agentId": "uuid",
  "nodePointer": "node-3",
  "variables": {},
  "memoryReferences": ["mem-1", "mem-2"],
  "callStack": ["node-1", "node-2", "node-3"],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Version History (`versions/{entityId}.json`)
```json
{
  "entityId": "uuid",
  "entityType": "agent",
  "versions": [
    {
      "entityId": "uuid",
      "entityType": "agent",
      "version": "1.0.0",
      "previousVersion": null,
      "bump": "major",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "currentVersion": "1.2.0"
}
```

## Adapters

| Adapter | Class | Subdir | Port |
|---|---|---|---|
| Local File Storage | `LocalFileStorageAdapter` | (configurable) | — |
| Snapshot Storage | `LocalSnapshotStorageAdapter` | `snapshots/` | `ISnapshotStoragePort` |
| Semantic Versioning | `SemanticVersioningAdapter` | `versions/` | `IVersioningPort` |

## Concurrency

All file operations use atomic write patterns (write to temp → rename). The `LocalFileStorageAdapter` ensures directory creation before writes. No locking mechanism is currently implemented — single-process access is assumed.
