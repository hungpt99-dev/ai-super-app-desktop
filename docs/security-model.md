# Security Model

## Overview

The Security Hardening layer provides defense-in-depth for the AgentHub platform through four mechanisms:

1. **Secret Vault** — Encrypted credential storage
2. **Encrypted Storage** — AES-256-GCM encryption for sensitive data
3. **IPC Schema Validator** — Runtime validation of IPC message payloads
4. **Tool Sandbox Enforcer** — Isolated execution with permission checks and timeouts

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Security Layer                        │
│  ┌──────────────┐  ┌──────────────────────────────┐     │
│  │ SecretVault   │  │ EncryptedStorage (AES-256-GCM)│    │
│  └──────────────┘  └──────────────────────────────┘     │
│  ┌──────────────┐  ┌──────────────────────────────┐     │
│  │IPCSchemaValid.│  │ ToolSandboxEnforcer          │    │
│  └──────────────┘  └──────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Secret Vault

Encrypted key-value store for API keys, tokens, and credentials.

```typescript
interface ISecretVaultPort {
  getSecret(key: string): Promise<string | null>
  setSecret(key: string, value: string): Promise<void>
  deleteSecret(key: string): Promise<void>
  listSecretKeys(): Promise<readonly string[]>
  hasSecret(key: string): Promise<boolean>
}
```

Implementation details:
- All values encrypted at rest using AES-256-GCM
- Keys are prefixed with `secret:` namespace
- Backed by `EncryptedStorageAdapter`

## Encrypted Storage

General-purpose encryption adapter using Web Crypto API.

```typescript
interface IEncryptedStoragePort {
  encrypt(key: string, data: string): Promise<void>
  decrypt(key: string): Promise<string | null>
  delete(key: string): Promise<void>
  has(key: string): Promise<boolean>
}
```

Implementation details:
- **Algorithm**: AES-256-GCM with 96-bit random IV
- **Key derivation**: PBKDF2 with SHA-256, 100,000 iterations
- **Salt**: Random 128-bit per encryption key
- **Storage format**: `base64(iv) + ':' + base64(salt) + ':' + base64(ciphertext)`
- **Platform**: Uses Web Crypto API (`crypto.subtle`)

## IPC Schema Validator

Runtime validation of IPC message payloads against registered schemas.

```typescript
interface IIPCSchemaValidatorPort {
  registerSchema(channel: string, schema: IIPCSchemaRule): void
  validate(channel: string, payload: unknown): IIPCValidationResult
  hasSchema(channel: string): boolean
}

interface IIPCSchemaRule {
  fields: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    required?: boolean
  }>
}
```

Validation checks:
- Required field presence
- Field type correctness
- Returns structured `IIPCValidationResult` with per-field errors

## Tool Sandbox Enforcer

Executes tool handlers in a restricted context with timeout enforcement.

```typescript
interface IToolSandboxEnforcerPort {
  execute(config: IToolSandboxConfig): Promise<IToolSandboxResult>
}

interface IToolSandboxConfig {
  toolName: string
  handler: (params: Record<string, unknown>) => Promise<unknown>
  params: Record<string, unknown>
  timeoutMs: number
  permissions: readonly string[]
}
```

Enforcement:
- **Timeout**: Configurable per-tool (uses `AbortSignal.timeout`)
- **Permission check**: Validates required permissions before execution
- **Error isolation**: Catches and wraps all execution errors
- **Result**: Returns `{ success, result?, error?, executionTimeMs }`

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Credential leakage | Secret Vault with AES-256-GCM |
| Malicious IPC payloads | Schema validation on all channels |
| Tool code injection | Sandbox with timeout and permission checks |
| Resource exhaustion | Rate limiter + budget manager (governance) |
| Unauthorized model access | Model registry allowlists |
| Plugin code escape | Plugin sandbox runner with permission isolation |

## Integration with Desktop

- Secret Vault adapter wraps Tauri's secure storage on desktop
- IPC Schema Validator runs in the main process before dispatching
- Tool Sandbox Enforcer wraps all tool executions in the execution engine
- Encrypted Storage is used for workspace-scoped sensitive configuration

## Best Practices

1. Never store secrets in plaintext — always use `ISecretVaultPort`
2. Validate all IPC payloads before processing
3. Set appropriate timeouts for all tool executions
4. Declare minimum required permissions for each tool
5. Use workspace-scoped encryption keys for data isolation
