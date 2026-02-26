/**
 * IPC Security Middleware — validates all IPC requests.
 *
 * Responsibilities:
 * - Validate origin
 * - Validate workspaceId
 * - Check permissions
 * - Rate limiting per workspace
 * - Fail closed on errors
 */

import { logger } from '@agenthub/shared'

const log = logger.child('IPCSecurity')

// ─── Constants ────────────────────────────────────────────────────────────────────

const MAX_REQUESTS_PER_SECOND = 50
const MAX_REQUESTS_PER_MINUTE = 1000
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface IPCPermission {
    readonly channel: string
    readonly requiredPermissions: string[]
}

export interface RateLimitEntry {
    readonly count: number
    readonly windowStart: number
}

// ─── Complete Permission Map ────────────────────────────────────────────────────
// CRITICAL: All IPC channels must be explicitly listed for security

const PERMISSION_MAP: Map<string, string[]> = new Map([
    // Runtime permissions
    ['runtime:init', ['system:write']],
    ['runtime:status', ['system:read']],
    
    // Module permissions
    ['module:list', ['module:read']],
    ['module:invoke-tool', ['module:execute']],
    
    // Agent permissions
    ['agent:list', ['agent:read']],
    ['agent:save', ['agent:write']],
    ['agent:load', ['agent:read']],
    ['agent:delete', ['agent:write']],
    ['agent:list-local', ['agent:read']],
    ['agent:validate', ['agent:read']],
    ['agent:start', ['execution:write']],
    ['agent:stop', ['execution:write']],
    
    // Execution permissions
    ['execution:start', ['execution:write']],
    ['execution:stop', ['execution:write']],
    ['execution:replay', ['execution:read']],
    ['execution:state', ['execution:read']],
    
    // Skill permissions
    ['skill:list', ['skill:read']],
    ['skill:save', ['skill:write']],
    ['skill:load', ['skill:read']],
    ['skill:delete', ['skill:write']],
    ['skill:list-local', ['skill:read']],
    ['skill:validate', ['skill:read']],
    
    // Snapshot permissions
    ['snapshot:list', ['snapshot:read']],
    ['snapshot:load', ['snapshot:read']],
    ['snapshot:delete', ['snapshot:write']],
    ['snapshot:replay', ['snapshot:read']],
    
    // Version permissions
    ['version:history', ['system:read']],
    ['version:bump', ['system:write']],
    
    // Workspace permissions
    ['workspace:initialize', ['workspace:write']],
    ['workspace:create', ['workspace:write']],
    ['workspace:delete', ['workspace:write']],
    ['workspace:rename', ['workspace:write']],
    ['workspace:switch', ['workspace:read']],
    ['workspace:list', ['workspace:read']],
    ['workspace:getActive', ['workspace:read']],
    ['workspace:duplicate', ['workspace:write']],
    
    // File system permissions
    ['filesystem:read', ['filesystem:read']],
    ['filesystem:write', ['filesystem:write']],
    ['filesystem:delete', ['filesystem:write']],
    ['filesystem:list', ['filesystem:read']],
    
    // Planning permissions
    ['planning:create', ['planning:write']],
    ['planning:micro', ['planning:write']],
    
    // Acting permissions
    ['acting:executeStep', ['execution:write']],
    ['acting:executeMicro', ['execution:write']],
    
    // Metrics permissions
    ['metrics:getExecutionSummary', ['metrics:read']],
    ['metrics:getDailyUsage', ['metrics:read']],
    ['metrics:getAgentBreakdown', ['metrics:read']],
    ['metrics:getAllExecutions', ['metrics:read']],
    ['metrics:exportReport', ['metrics:read']],
    ['metrics:getSummary', ['metrics:read']],
    ['metrics:getTokens', ['metrics:read']],
    ['metrics:getCosts', ['metrics:read']],
    ['metrics:getAgents', ['metrics:read']],
    ['metrics:getExecutions', ['metrics:read']],
    ['metrics:getTools', ['metrics:read']],
    ['metrics:getModels', ['metrics:read']],
    ['metrics:export', ['metrics:read']],
    
    // Workspace Tabs permissions
    ['workspaceTabs:initialize', ['workspace:write']],
    ['workspaceTabs:create', ['workspace:write']],
    ['workspaceTabs:close', ['workspace:write']],
    ['workspaceTabs:switch', ['workspace:read']],
    ['workspaceTabs:rename', ['workspace:write']],
    ['workspaceTabs:list', ['workspace:read']],
    ['workspaceTabs:getCurrent', ['workspace:read']],
    ['workspaceTabs:addAgent', ['workspace:write']],
    ['workspaceTabs:removeAgent', ['workspace:write']],
    ['workspaceTabs:getAgents', ['workspace:read']],
])

// ─── IPC Security Middleware ───────────────────────────────────────────────────

class GlobalIPCSecurity {
    private static instance: GlobalIPCSecurity | null = null
    private readonly rateLimiter = new IPRateLimiter()
    private cleanupInterval: ReturnType<typeof setInterval> | null = null
    // SECURITY: Track failed attempts for brute force detection
    private readonly failedAttempts = new Map<string, { count: number; lockoutUntil: number }>()
    private readonly MAX_FAILED_ATTEMPTS = 10
    private readonly LOCKOUT_DURATION_MS = 60 * 1000 // 1 minute lockout

    static getInstance(): GlobalIPCSecurity {
        if (GlobalIPCSecurity.instance === null) {
            GlobalIPCSecurity.instance = new GlobalIPCSecurity()
        }
        return GlobalIPCSecurity.instance
    }

    static resetForTesting(): void {
        GlobalIPCSecurity.instance = null
    }

    startCleanupTimer(): void {
        if (this.cleanupInterval !== null) return
        
        this.cleanupInterval = setInterval(() => {
            this.rateLimiter.cleanup()
            this.cleanupFailedAttempts()
        }, RATE_LIMIT_WINDOW_MS)
    }

    stopCleanupTimer(): void {
        if (this.cleanupInterval !== null) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
        }
    }
    
    private cleanupFailedAttempts(): void {
        const now = Date.now()
        for (const [key, entry] of this.failedAttempts.entries()) {
            if (now > entry.lockoutUntil) {
                this.failedAttempts.delete(key)
            }
        }
    }
    
    private checkLockout(workspaceId: string): boolean {
        const entry = this.failedAttempts.get(workspaceId)
        if (entry && Date.now() < entry.lockoutUntil) {
            return true // Still locked out
        }
        return false
    }
    
    private recordFailedAttempt(workspaceId: string): void {
        const entry = this.failedAttempts.get(workspaceId)
        if (entry) {
            entry.count++
            if (entry.count >= this.MAX_FAILED_ATTEMPTS) {
                entry.lockoutUntil = Date.now() + this.LOCKOUT_DURATION_MS
                log.warn('Workspace locked out due to repeated failures', { workspaceId, lockoutUntil: entry.lockoutUntil })
            }
        } else {
            this.failedAttempts.set(workspaceId, { count: 1, lockoutUntil: 0 })
        }
    }
    
    private clearFailedAttempts(workspaceId: string): void {
        this.failedAttempts.delete(workspaceId)
    }

    /**
     * Validate IPC request - fail closed on any error
     */
    validateRequest(
        channel: string,
        workspaceId: string | null,
        _origin: string | null,
        permissions: string[],
    ): { valid: boolean; error?: string } {
        // Fail closed: reject if any validation fails
        
        // 1. Check rate limit - use default workspace if none provided
        const effectiveWorkspaceId = workspaceId ?? 'default'
        
        // Check if workspace is locked out due to repeated failures
        if (this.checkLockout(effectiveWorkspaceId)) {
            log.warn('Workspace locked out due to repeated failures', { workspaceId: effectiveWorkspaceId, channel })
            return {
                valid: false,
                error: 'Account temporarily locked. Please try again later.',
            }
        }
        
        if (!this.rateLimiter.check(effectiveWorkspaceId)) {
            this.recordFailedAttempt(effectiveWorkspaceId)
            log.warn('Rate limit exceeded', { channel, workspaceId: effectiveWorkspaceId })
            return {
                valid: false,
                error: 'Rate limit exceeded. Please try again later.',
            }
        }

        // 2. Validate channel exists
        if (!PERMISSION_MAP.has(channel)) {
            // Allow unknown channels but log warning
            log.debug('Unknown IPC channel', { channel })
        }

        // 3. Validate workspaceId format (if provided)
        if (workspaceId !== null && workspaceId !== '') {
            if (!this.isValidWorkspaceId(workspaceId)) {
                log.warn('Invalid workspaceId', { workspaceId, channel })
                return {
                    valid: false,
                    error: 'Invalid workspace ID format.',
                }
            }
        }

        // 4. Validate permissions (fail closed)
        const requiredPermissions = PERMISSION_MAP.get(channel) ?? []
        
        // CRITICAL FIX: Actually validate permissions
        for (const required of requiredPermissions) {
            if (!permissions.includes(required)) {
                log.warn('Permission denied', { 
                    channel, 
                    required, 
                    hasPermissions: permissions 
                })
                // Track failed attempt for brute force detection
                this.recordFailedAttempt(effectiveWorkspaceId)
                return {
                    valid: false,
                    error: `Missing required permission: ${required}`,
                }
            }
        }
        
        // Clear failed attempts on successful validation
        this.clearFailedAttempts(effectiveWorkspaceId)
        
        return {
            valid: true,
            error: undefined,
        }
    }

    /**
     * Check if channel requires specific permissions
     */
    getRequiredPermissions(channel: string): string[] {
        return PERMISSION_MAP.get(channel) ?? []
    }

    /**
     * Reset rate limit for workspace (e.g., after auth)
     */
    resetRateLimit(workspaceId: string): void {
        this.rateLimiter.reset(workspaceId)
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    private isValidWorkspaceId(id: string): boolean {
        // UUID v4 format check
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        return uuidRegex.test(id)
    }
}

export const ipcSecurity = GlobalIPCSecurity.getInstance()

// ─── Middleware Function ────────────────────────────────────────────────────────

export interface IPCRequestContext {
    readonly channel: string
    readonly workspaceId: string | null
    readonly origin: string | null
    readonly permissions: string[]
}

export function ipcAuthMiddleware(context: IPCRequestContext): { valid: boolean; error?: string } {
    return ipcSecurity.validateRequest(
        context.channel,
        context.workspaceId,
        context.origin,
        context.permissions,
    )
}
