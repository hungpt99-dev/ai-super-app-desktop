/**
 * Command Whitelist — restricts shell commands to safe set.
 *
 * Responsibilities:
 * - Enforce command whitelist for runShell
 * - Prevent arbitrary command execution
 * - Log all command attempts
 */

import { logger } from '@agenthub/shared'

const log = logger.child('CommandWhitelist')

// ─── Whitelist Configuration ────────────────────────────────────────────────────

const ALLOWED_COMMANDS = new Set<string>([
    // Git commands
    'git',
    'git-remote-https',
    'git-receive-pack',
    'git-upload-pack',
    
    // Package managers
    'npm',
    'npx',
    'yarn',
    'pnpm',
    'bun',
    
    // Node.js
    'node',
    'nvm',
    'nvs',
    
    // Build tools
    'make',
    'cmake',
    'gradle',
    'mvn',
    
    // Text editors (for editing)
    'nano',
    'vim',
    'emacs',
    
    // File operations
    'ls',
    'cat',
    'grep',
    'find',
    'awk',
    'sed',
    'sort',
    'uniq',
    'head',
    'tail',
    'wc',
    
    // Directory operations
    'cd',
    'pwd',
    'mkdir',
    'rmdir',
    'rm',
    'cp',
    'mv',
    
    // System info
    'ps',
    'top',
    'df',
    'du',
    'whoami',
    'uname',
    
    // Network
    'curl',
    'wget',
    'ssh',
    'scp',
    
    // Python (common for AI agents)
    'python',
    'python3',
    'pip',
    'pip3',
    'virtualenv',
    
    // Documentation
    'man',
    'help',
    
    // Compression
    'tar',
    'gzip',
    'gunzip',
    'zip',
    'unzip',
])

// Dangerous patterns that should always be blocked
const BLOCKED_PATTERNS = [
    /;\s*rm\s+-rf/i,
    /;\s*del\s+\/[fqs]/i,
    /\|\s*sh\s*$/i,
    /&\s*&\s*rm/i,
    /^\s*format\s+/i,
    /^\s*mkfs/i,
    /^\s*dd\s+if=/i,
    />\s*\/dev\/sd/i,
    /eval\s*\(/i,
    /exec\s*\(/i,
    /system\s*\(/i,
    /\$\s*\(/i,
    /`.*`/i,
]

// ─── Command Validator ─────────────────────────────────────────────────────────

export interface CommandValidationResult {
    readonly allowed: boolean
    readonly error?: string
    readonly command?: string
    readonly args?: string[]
}

export class CommandWhitelistValidator {
    private readonly customAllowedCommands: Set<string> = new Set(ALLOWED_COMMANDS)

    /**
     * Validate a shell command against the whitelist
     */
    validate(command: string): CommandValidationResult {
        // Extract the base command (first word)
        const parts = command.trim().split(/\s+/)
        const baseCommand = parts[0]?.toLowerCase() ?? ''

        // Check for dangerous patterns first
        for (const pattern of BLOCKED_PATTERNS) {
            if (pattern.test(command)) {
                log.warn('Blocked dangerous command pattern', { command, pattern: pattern.source })
                return {
                    allowed: false,
                    error: 'Command contains dangerous pattern',
                }
            }
        }

        // Check whitelist
        if (!this.customAllowedCommands.has(baseCommand)) {
            log.warn('Command not in whitelist', { command, baseCommand })
            return {
                allowed: false,
                error: `Command '${baseCommand}' not allowed. Allowed commands: ${this.getAllowedList()}`,
            }
        }

        log.debug('Command allowed', { command, baseCommand })

        return {
            allowed: true,
            command: baseCommand,
            args: parts.slice(1),
        }
    }

    /**
     * Add a command to the whitelist
     */
    allowCommand(command: string): void {
        this.customAllowedCommands.add(command.toLowerCase())
        log.info('Added command to whitelist', { command })
    }

    /**
     * Remove a command from the whitelist
     */
    blockCommand(command: string): void {
        this.customAllowedCommands.delete(command.toLowerCase())
        log.info('Removed command from whitelist', { command })
    }

    /**
     * Get list of allowed commands
     */
    getAllowedList(): string {
        return Array.from(this.customAllowedCommands).sort().join(', ')
    }

    /**
     * Check if a command is allowed
     */
    isAllowed(command: string): boolean {
        const parts = command.trim().split(/\s+/)
        const baseCommand = parts[0]?.toLowerCase() ?? ''
        return this.customAllowedCommands.has(baseCommand)
    }
}

// ─── Singleton ───────────────────────────────────────────────────────────────────

let validatorInstance: CommandWhitelistValidator | null = null

export function getCommandValidator(): CommandWhitelistValidator {
    if (validatorInstance === null) {
        validatorInstance = new CommandWhitelistValidator()
    }
    return validatorInstance
}

// ─── Wrapper for runShell ───────────────────────────────────────────────────────

export function validateShellCommand(command: string): CommandValidationResult {
    return getCommandValidator().validate(command)
}
