# Plugin System

## Overview

The Plugin System enables third-party extensions to register tools, skills, model providers, and middleware with AgentHub. Plugins are sandboxed, permission-controlled, and lifecycle-managed.

## Architecture

```
┌──────────────────────────────────────────┐
│             Plugin Runtime               │
│  ┌──────────────┐  ┌─────────────────┐   │
│  │ PluginLoader  │  │ PluginRegistry  │   │
│  └──────────────┘  └─────────────────┘   │
│  ┌──────────────────────────────────┐    │
│  │ PluginSandboxRunner              │    │
│  └──────────────────────────────────┘    │
├──────────────────────────────────────────┤
│             Plugin SDK                   │
│  definePlugin(), createManifest()        │
└──────────────────────────────────────────┘
```

## Package Structure (.ahpkg)

```
my-plugin/
  manifest.json       — Name, version, permissions, entry point
  prompt.yaml         — Optional prompt templates
  logic.ts            — Plugin entry (exports IAgentHubPlugin)
  ui_schema.json      — Optional UI schema
  permissions.json    — Required permissions declaration
```

## Plugin Manifest

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Adds custom tools",
  "author": "Developer",
  "entry": "logic.ts",
  "permissions": ["http.request", "filesystem.read"],
  "minPlatformVersion": "1.0.0"
}
```

## Plugin Lifecycle

```
installed → registered → active → deactivated → uninstalled
                ↑                      │
                └──────────────────────┘
```

1. **Install** — Copy package to `~/.agenthub/plugins/`
2. **Load** — Parse manifest, validate permissions
3. **Register** — Call `plugin.register(context)` with sandboxed API
4. **Activate** — Make tools/skills/providers available to agents
5. **Deactivate** — Remove from active registrations
6. **Uninstall** — Delete from disk

## Authoring a Plugin

```typescript
import { definePlugin, createManifest } from '@agenthub/plugin-sdk'

export default definePlugin({
  register(ctx) {
    ctx.registerTool({
      name: 'my-tool',
      description: 'Does something useful',
      parameters: { input: { type: 'string', required: true } },
      handler: async (params) => ({ result: params.input.toUpperCase() }),
    })
  },
  activate() { /* optional */ },
  deactivate() { /* optional */ },
})
```

## Plugin Context (Sandboxed)

The `IPluginContext` provided to `register()` exposes:
- `registerTool(registration)` — Add a tool
- `registerSkill(registration)` — Add a skill
- `registerModelProvider(registration)` — Add a model provider
- `registerMiddleware(registration)` — Add pre/post execution middleware
- `logger` — Scoped logger instance
- `storage` — Scoped key-value storage

All registrations are namespaced by plugin ID to prevent conflicts.

## Security

- Plugins declare required permissions in their manifest
- Runtime validates permissions before activation
- Sandbox runner enforces execution timeouts (default: 30 seconds)
- Plugin code cannot access system APIs directly

## IPC Channels

| Channel | Payload | Result |
|---------|---------|--------|
| `plugin:install` | `IPluginInstallPayload` | `void` |
| `plugin:uninstall` | `string` (pluginId) | `void` |
| `plugin:activate` | `string` (pluginId) | `void` |
| `plugin:deactivate` | `string` (pluginId) | `void` |
| `plugin:list` | `null` | `IPluginListResult` |
| `plugin:get` | `string` (pluginId) | `IPluginDetailResult` |
