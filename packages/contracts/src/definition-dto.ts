/**
 * Definition DTOs — serializable data transfer objects for agent/skill definitions.
 *
 * Used for custom agent creation, marketplace browse, import/export,
 * and capability enforcement at definition level. No behaviour — pure data shapes.
 *
 * See: agents.md for AgentHub agent overview.
 */

// ─── Capability Definition DTO ──────────────────────────────────────────────

export type CapabilityScope =
    | 'tool'
    | 'network'
    | 'memory'
    | 'token_budget'
    | 'agent_boundary'
    | 'filesystem'
    | 'computer'

export interface ICapabilityDefinitionDTO {
    readonly name: string
    readonly description: string
    readonly scope: CapabilityScope
    /** If true, this capability is considered high-risk and requires explicit user approval. */
    readonly dangerousPermission?: boolean | undefined
    /** Capabilities that cannot be combined with this one. */
    readonly forbiddenWith?: readonly string[] | undefined
    /** Capabilities that this one requires as prerequisites. */
    readonly requires?: readonly string[] | undefined
}

// ─── Memory Config ──────────────────────────────────────────────────────────

export type MemoryScope = 'working' | 'session' | 'long-term'

export interface IMemoryConfigDTO {
    readonly enabled: boolean
    readonly scopes: readonly MemoryScope[]
    readonly maxEntriesPerScope?: number | undefined
    readonly persistAcrossSessions?: boolean | undefined
}

// ─── Tool Config ────────────────────────────────────────────────────────────

export interface IToolConfigDTO {
    readonly name: string
    readonly description: string
    readonly inputSchema: Record<string, unknown>
    readonly timeoutMs?: number | undefined
    readonly requiredCapabilities?: readonly string[] | undefined
}

// ─── Skill Definition DTO ───────────────────────────────────────────────────

export interface ISkillDefinitionDTO {
    readonly id: string
    readonly name: string
    readonly version: string
    readonly description: string
    /** Skill type: llm_prompt, tool_wrapper, or graph_fragment. */
    readonly type?: 'llm_prompt' | 'tool_wrapper' | 'graph_fragment' | undefined
    /** Capabilities that an agent must declare to use this skill. */
    readonly requiredCapabilities: readonly string[]
    /** Permissions this skill needs at runtime. */
    readonly permissions: readonly string[]
    /** Tools this skill exposes. */
    readonly tools: readonly IToolConfigDTO[]
    readonly category: string
    readonly author?: string | undefined
    readonly icon?: string | undefined
    readonly tags?: readonly string[] | undefined
    readonly inputSchema?: Record<string, unknown> | undefined
    readonly outputSchema?: Record<string, unknown> | undefined
    /** LLM model identifier for llm_prompt type skills. */
    readonly model?: string | undefined
    /** Temperature for LLM-based skills (0-2). */
    readonly temperature?: number | undefined
    /** System prompt for LLM-based skills. */
    readonly systemPrompt?: string | undefined
    /** User prompt template for LLM-based skills. */
    readonly promptTemplate?: string | undefined
    /** Tool identifier for tool_wrapper type skills. */
    readonly toolName?: string | undefined
    /** Cryptographic signature for marketplace trust verification. */
    readonly signature?: string | undefined
    readonly createdAt?: string | undefined
    readonly updatedAt?: string | undefined
}

// ─── Agent Definition DTO ───────────────────────────────────────────────────

export interface IAgentDefinitionDTO {
    readonly id: string
    readonly name: string
    readonly version: string
    readonly description: string
    /** Capabilities this agent explicitly declares it has. */
    readonly capabilities: readonly string[]
    /** Permissions this agent requires. */
    readonly permissions: readonly string[]
    /** Memory configuration. */
    readonly memoryConfig: IMemoryConfigDTO
    /** Tools the agent can use directly (not via skills). */
    readonly tools: readonly IToolConfigDTO[]
    /** Skills attached to this agent. */
    readonly skills: readonly ISkillDefinitionDTO[]
    readonly author?: string | undefined
    readonly icon?: string | undefined
    readonly category?: string | undefined
    readonly tags?: readonly string[] | undefined
    /** Maximum token budget for executions. */
    readonly maxTokenBudget?: number | undefined
    /** System prompt template. */
    readonly systemPrompt?: string | undefined
    /** AI model to use. */
    readonly model?: string | undefined
    /** Cryptographic signature for marketplace trust verification. */
    readonly signature?: string | undefined
    readonly createdAt?: string | undefined
    readonly updatedAt?: string | undefined
}

// ─── Validation Result DTO ──────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface IValidationIssue {
    readonly field: string
    readonly message: string
    readonly severity: ValidationSeverity
    readonly code: string
}

export interface IValidationResultDTO {
    readonly valid: boolean
    readonly issues: readonly IValidationIssue[]
    readonly checkedAt: string
}

// ─── Install Result DTO ─────────────────────────────────────────────────────

export type InstallStatus = 'success' | 'failed' | 'already_installed' | 'version_conflict'

export interface IInstallResultDTO {
    readonly status: InstallStatus
    readonly agentId?: string | undefined
    readonly skillId?: string | undefined
    readonly name: string
    readonly version: string
    readonly message: string
    readonly installedAt?: string | undefined
    readonly previousVersion?: string | undefined
    readonly validationResult?: IValidationResultDTO | undefined
}

// ─── Marketplace Listing DTO ────────────────────────────────────────────────

export interface IMarketplaceListingDTO {
    readonly id: string
    readonly name: string
    readonly version: string
    readonly description: string
    readonly author: string
    readonly category: string
    readonly tags: readonly string[]
    readonly icon?: string | undefined
    readonly downloadCount: number
    readonly rating: number
    readonly verified: boolean
    readonly signature?: string | undefined
    readonly publishedAt: string
}

export interface IAgentMarketplaceListingDTO extends IMarketplaceListingDTO {
    readonly type: 'agent'
    readonly capabilities: readonly string[]
    readonly skillCount: number
    readonly toolCount: number
}

export interface ISkillMarketplaceListingDTO extends IMarketplaceListingDTO {
    readonly type: 'skill'
    readonly requiredCapabilities: readonly string[]
    readonly toolCount: number
}
