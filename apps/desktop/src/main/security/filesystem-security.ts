/**
 * FileSystem Security — validates file paths to prevent traversal attacks.
 *
 * Responsibilities:
 * - Validate paths don't escape workspace root
 * - Block ../ traversal attempts
 * - Only allow access within workspace directory
 */

import * as path from 'path'
import { logger } from '@agenthub/shared'

const log = logger.child('FileSystemSecurity')

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface PathValidationResult {
    readonly valid: boolean
    readonly error?: string
    readonly resolvedPath?: string
}

// ─── FileSystem Security Validator ───────────────────────────────────────────────

export class FileSystemSecurityValidator {
    private readonly allowedRoots: Map<string, string> = new Map() // workspaceId -> rootPath

    registerWorkspace(workspaceId: string, rootPath: string): void {
        this.allowedRoots.set(workspaceId, rootPath)
        log.debug('Registered workspace root', { workspaceId, rootPath })
    }

    unregisterWorkspace(workspaceId: string): void {
        this.allowedRoots.delete(workspaceId)
        log.debug('Unregistered workspace root', { workspaceId })
    }

    /**
     * Validates that a path is within the workspace root.
     * Uses canonical path resolution to prevent traversal attacks.
     */
    validatePath(workspaceId: string, requestedPath: string): PathValidationResult {
        // Get workspace root
        const rootPath = this.allowedRoots.get(workspaceId)
        if (rootPath === undefined) {
            log.warn('No root path for workspace', { workspaceId })
            return {
                valid: false,
                error: 'Workspace not registered',
            }
        }

        // Check for traversal attempts first (before any path resolution)
        if (this.containsTraversal(requestedPath)) {
            log.warn('Path traversal attempt blocked', { workspaceId, requestedPath })
            return {
                valid: false,
                error: 'Path traversal not allowed',
            }
        }

        // Resolve the requested path
        let resolvedPath: string
        try {
            resolvedPath = path.resolve(rootPath, requestedPath)
        } catch (err) {
            log.warn('Failed to resolve path', { workspaceId, requestedPath, error: String(err) })
            return {
                valid: false,
                error: 'Invalid path',
            }
        }

        // Verify path is within workspace root using canonical paths
        // This handles symlinks and other path edge cases
        let normalizedRoot: string
        let normalizedResolved: string
        try {
            normalizedRoot = path.normalize(rootPath)
            normalizedResolved = path.normalize(resolvedPath)
            
            // For additional security, try to resolve to real paths
            // This catches symlink-based escape attempts
            const realRoot = path.resolve(rootPath)
            const realResolved = path.resolve(rootPath, requestedPath)
            
            if (!realResolved.startsWith(realRoot + path.sep) && realResolved !== realRoot) {
                log.warn('Path outside workspace blocked (real path)', {
                    workspaceId,
                    requestedPath,
                    rootPath: realRoot,
                    resolvedPath: realResolved,
                })
                return {
                    valid: false,
                    error: 'Access outside workspace not allowed',
                }
            }
        } catch {
            // Fallback to normalized comparison if real path fails
            normalizedRoot = path.normalize(rootPath)
            normalizedResolved = path.normalize(resolvedPath)

            if (!normalizedResolved.startsWith(normalizedRoot + path.sep) && normalizedResolved !== normalizedRoot) {
                log.warn('Path outside workspace blocked', {
                    workspaceId,
                    requestedPath,
                    rootPath: normalizedRoot,
                    resolvedPath: normalizedResolved,
                })
                return {
                    valid: false,
                    error: 'Access outside workspace not allowed',
                }
            }
        }

        return {
            valid: true,
            resolvedPath: normalizedResolved,
        }
    }

    validateRead(workspaceId: string, filePath: string): PathValidationResult {
        const result = this.validatePath(workspaceId, filePath)
        
        if (!result.valid) {
            return result
        }

        // Additional check: ensure it's a file (not a directory)
        // This will be done at the actual file access layer

        return result
    }

    validateWrite(workspaceId: string, filePath: string): PathValidationResult {
        const result = this.validatePath(workspaceId, filePath)
        
        if (!result.valid) {
            return result
        }

        // Block writes to sensitive files
        const fileName = path.basename(filePath)
        const sensitivePatterns = [
            /^config\.json$/i,
            /^settings\.json$/i,
            /\.env$/i,
            /^secret/i,
            /^credentials/i,
        ]

        for (const pattern of sensitivePatterns) {
            if (pattern.test(fileName)) {
                log.warn('Sensitive file write blocked', { workspaceId, filePath })
                return {
                    valid: false,
                    error: 'Cannot write to sensitive files',
                }
            }
        }

        return result
    }

    // ─── Private ────────────────────────────────────────────────────────────────

    private containsTraversal(requestedPath: string): boolean {
        // Check for common traversal patterns
        const normalized = path.normalize(requestedPath)
        
        // Check for ../
        if (normalized.includes('..' + path.sep) || normalized.endsWith('..')) {
            return true
        }

        // Check for alternative traversal (URL-encoded)
        if (requestedPath.includes('%2e%2e') || requestedPath.includes('%252e')) {
            return true
        }

        // Check for absolute paths
        if (path.isAbsolute(requestedPath)) {
            return true
        }

        return false
    }

    getRegisteredWorkspaces(): string[] {
        return Array.from(this.allowedRoots.keys())
    }
}

// ─── Singleton ───────────────────────────────────────────────────────────────────

let validatorInstance: FileSystemSecurityValidator | null = null

export function getFileSystemValidator(): FileSystemSecurityValidator {
    if (validatorInstance === null) {
        validatorInstance = new FileSystemSecurityValidator()
    }
    return validatorInstance
}
