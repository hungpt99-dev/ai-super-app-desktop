/**
 * DTO — Data Transfer Objects.
 *
 * Typed shapes for data crossing system boundaries (API responses,
 * IPC messages, event payloads). DTOs carry no behaviour — they are
 * plain serializable objects.
 *
 * Convention: suffix every DTO type with `DTO`.
 * See: docs/codebase.md Naming Convention
 */

// ── API DTOs ────────────────────────────────────────────────────────────────

/** API error envelope returned by the cloud gateway. */
export interface ApiErrorDTO {
    readonly code: string
    readonly message: string
    readonly details?: unknown
}

/** Usage report DTO returned by GET /v1/usage. */
export interface UsageReportDTO {
    readonly tokensInput: number
    readonly tokensOutput: number
    readonly creditsDeducted: number
    readonly model: string
    readonly timestamp: string
}

/** Subscription info DTO from GET /v1/subscription. */
export interface SubscriptionDTO {
    readonly plan: 'free' | 'pro' | 'enterprise'
    readonly tokensRemaining: number
    readonly tokensLimit: number
    readonly renewsAt?: string
    readonly isActive: boolean
}

// ── Agent DTOs ──────────────────────────────────────────────────────────────

/** Agent run result DTO sent from desktop to cloud. */
export interface AgentRunResultDTO {
    readonly runId: string
    readonly status: 'completed' | 'failed'
    readonly steps: number
    readonly result?: Record<string, unknown>
    readonly completedAt: string
}

/** Agent device registration DTO. */
export interface AgentDeviceDTO {
    readonly id: string
    readonly name: string
    readonly platform: string
    readonly version: string
    readonly status: 'online' | 'offline'
}
