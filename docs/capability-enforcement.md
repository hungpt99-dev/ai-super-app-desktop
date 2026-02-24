# Capability Enforcement

## Overview

All tool execution is gated by mandatory capability checks. The `CapabilityGuard` class ensures agents can only execute tools they are authorized for.

## Capability Model

Capabilities are string codes assigned to agents:

| Code | Grants |
|------|--------|
| `filesystem` | `file.read`, `file.write` |
| `browser` | `browser.open` |
| `network` | `http.fetch` |
| `os` | `os.exec` |

## Enforcement Flow

```
ToolExecutor.execute(toolName, input, agentCapabilities)
    → CapabilityGuard.check(agentCapabilities, tool.requiredCapabilities)
    → If missing → CapabilityViolationError thrown
    → If granted → Tool executed
```

## CapabilityGuard API

```typescript
class CapabilityGuard {
    ensure(agentCapabilities: string[], requiredCapabilities: string[]): void
    check(agentCapabilities: string[], requiredCapabilities: string[]): { granted: boolean; missing: string[] }
}
```

- `ensure()` — throws `CapabilityViolationError` on failure
- `check()` — returns result without throwing

## CapabilityViolationError

```typescript
class CapabilityViolationError extends Error {
    agentCapabilities: string[]
    requiredCapabilities: string[]
    missingCapabilities: string[]
}
```

## Rules

1. Capability enforcement runs in main process ONLY
2. Renderer cannot bypass capability checks
3. All capability checks are logged in `ExecutionResult.capabilityChecks`
4. Tools with empty `requiredCapabilities` are unrestricted
5. All checks are deterministic — no randomness
