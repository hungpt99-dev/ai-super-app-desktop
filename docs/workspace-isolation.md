# Workspace Isolation

## Overview

Workspace Isolation ensures that agents, memory, configuration, and files are scoped to independent workspaces. Each workspace has its own storage layout, and switching workspaces changes the active scope for all operations.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│               WorkspaceManager (Port)                   │
│                                                         │
│  createWorkspace() ──► generates isolated directory tree │
│  switchWorkspace() ──► changes active context           │
│  deleteWorkspace() ──► removes all workspace data       │
│                                                         │
│  Adapter: WorkspaceStorageAdapter (infrastructure)       │
└─────────────────────────────────────────────────────────┘
```

## Workspace Layout

Each workspace gets an isolated directory tree:

```
~/.agenthub/workspaces/{workspace-id}/
  agents/          — Agent definitions and state
  skills/          — Skill definitions
  memory/          — Agent memory stores
  snapshots/       — Execution snapshots
  config/          — Workspace configuration
  plugins/         — Workspace-scoped plugin data
  logs/            — Execution logs
```

## Port Interface

```typescript
interface IWorkspaceManagerPort {
  createWorkspace(name: string): Promise<IWorkspaceInfo>
  deleteWorkspace(workspaceId: string): Promise<void>
  switchWorkspace(workspaceId: string): Promise<void>
  getCurrentWorkspace(): Promise<IWorkspaceInfo>
  listWorkspaces(): Promise<readonly IWorkspaceInfo[]>
  getWorkspaceLayout(workspaceId: string): Promise<IWorkspaceLayout>
}
```

## Workspace Info

```typescript
interface IWorkspaceInfo {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  isDefault: boolean
}

interface IWorkspaceLayout {
  agentsDir: string
  skillsDir: string
  memoryDir: string
  snapshotsDir: string
  configDir: string
  pluginsDir: string
  logsDir: string
}
```

## Default Workspace

- A default workspace is always present and cannot be deleted.
- On first launch, the default workspace is created automatically.
- The current workspace ID is persisted and restored on app restart.

## Cross-Workspace Concerns

- **Policy rules** can be global or workspace-scoped.
- **Budget tracking** is per-agent per-workspace.
- **Model registry** allowlists/denylists are per-workspace.
- **Plugins** are installed globally but their data is workspace-scoped.

## IPC Channels

| Channel | Payload | Result |
|---------|---------|--------|
| `workspace:create` | `IWorkspaceCreatePayload` | `IWorkspaceResult` |
| `workspace:delete` | `string` (workspaceId) | `void` |
| `workspace:list` | `null` | `IWorkspaceListResult` |
| `workspace:get` | `string` (workspaceId) | `IWorkspaceResult` |
| `workspace:switch` | `string` (workspaceId) | `void` |
| `workspace:get-current` | `null` | `IWorkspaceResult` |

## Desktop UI

The **WorkspaceManagerPage** provides:
- List all workspaces with active indicator
- Create new workspace with name input
- Switch between workspaces
- Delete non-default workspaces with confirmation
