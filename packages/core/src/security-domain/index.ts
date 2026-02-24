/**
 * SecurityDomain — core ports for secret vault, encrypted storage,
 * IPC validation, and tool sandbox enforcement.
 */

// ─── Secret Vault Port ──────────────────────────────────────────────────────

export interface ISecretVaultPort {
    store(key: string, value: string): Promise<void>
    retrieve(key: string): Promise<string | null>
    delete(key: string): Promise<void>
    exists(key: string): Promise<boolean>
    list(): Promise<readonly string[]>
    rotate(key: string, newValue: string): Promise<void>
}

// ─── Encrypted Storage Port ─────────────────────────────────────────────────

export interface IEncryptedStoragePort {
    encrypt(plaintext: string): Promise<string>
    decrypt(ciphertext: string): Promise<string>
    writeEncrypted(key: string, data: unknown): Promise<void>
    readEncrypted<T>(key: string): Promise<T | null>
    deleteEncrypted(key: string): Promise<void>
}

// ─── IPC Schema Validation ──────────────────────────────────────────────────

export interface IIPCSchemaRule {
    readonly channel: string
    readonly payloadSchema: Record<string, unknown>
    readonly required: readonly string[]
}

export interface IIPCValidationResult {
    readonly valid: boolean
    readonly errors: readonly string[]
    readonly channel: string
}

export interface IIPCSchemaValidatorPort {
    validate(channel: string, payload: unknown): IIPCValidationResult
    registerSchema(rule: IIPCSchemaRule): void
    removeSchema(channel: string): void
    listSchemas(): readonly IIPCSchemaRule[]
}

// ─── Tool Sandbox Enforcement ───────────────────────────────────────────────

export interface IToolSandboxConfig {
    readonly maxExecutionTimeMs: number
    readonly maxMemoryBytes: number
    readonly allowedApis: readonly string[]
    readonly deniedApis: readonly string[]
    readonly networkAccess: boolean
    readonly fileSystemAccess: boolean
}

export interface IToolSandboxResult {
    readonly success: boolean
    readonly output: unknown
    readonly error?: string
    readonly durationMs: number
    readonly memoryUsedBytes: number
}

export interface IToolSandboxEnforcerPort {
    execute(toolName: string, input: Record<string, unknown>, config: IToolSandboxConfig): Promise<IToolSandboxResult>
    getDefaultConfig(): IToolSandboxConfig
    setDefaultConfig(config: IToolSandboxConfig): void
}
