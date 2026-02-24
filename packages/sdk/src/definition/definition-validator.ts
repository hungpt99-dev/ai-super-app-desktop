/**
 * DefinitionValidator — validates AgentDefinitionDTO and SkillDefinitionDTO.
 *
 * Pure validation logic — no runtime or infrastructure dependencies.
 * Returns structured validation results with field-level error reporting.
 *
 * Checks:
 *   - Missing required fields
 *   - Duplicate IDs
 *   - Invalid capability graph
 *   - Skill requiring capability not declared in agent
 *   - Forbidden capability combinations
 *   - Memory config invalid
 *   - Tool config invalid
 */

import type {
    IAgentDefinitionDTO,
    ISkillDefinitionDTO,
    IValidationResultDTO,
    IValidationIssue,
    ValidationSeverity,
    ICapabilityDefinitionDTO,
} from '@agenthub/contracts'

// ─── Semver helper ──────────────────────────────────────────────────────────

const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/

function isValidSemver(version: string): boolean {
    return SEMVER_REGEX.test(version)
}

// ─── Issue builder helper ───────────────────────────────────────────────────

function issue(
    field: string,
    message: string,
    code: string,
    severity: ValidationSeverity = 'error',
): IValidationIssue {
    return { field, message, severity, code }
}

// ─── Agent Validation ───────────────────────────────────────────────────────

export function validateAgentDefinition(
    agent: IAgentDefinitionDTO,
    knownCapabilities?: readonly ICapabilityDefinitionDTO[],
): IValidationResultDTO {
    const issues: IValidationIssue[] = []

    // ── Required fields ──────────────────────────────────────────────────
    if (!agent.id || agent.id.trim().length === 0) {
        issues.push(issue('id', 'Agent ID is required.', 'AGENT_ID_REQUIRED'))
    }

    if (!agent.name || agent.name.trim().length === 0) {
        issues.push(issue('name', 'Agent name is required.', 'AGENT_NAME_REQUIRED'))
    } else if (agent.name.length > 128) {
        issues.push(issue('name', 'Agent name must be 128 characters or fewer.', 'AGENT_NAME_TOO_LONG'))
    }

    if (!agent.version || agent.version.trim().length === 0) {
        issues.push(issue('version', 'Agent version is required.', 'AGENT_VERSION_REQUIRED'))
    } else if (!isValidSemver(agent.version)) {
        issues.push(issue('version', 'Agent version must be valid semver (e.g., 1.0.0).', 'AGENT_VERSION_INVALID'))
    }

    if (!agent.description || agent.description.trim().length === 0) {
        issues.push(issue('description', 'Agent description is required.', 'AGENT_DESCRIPTION_REQUIRED'))
    } else if (agent.description.length > 1024) {
        issues.push(issue('description', 'Agent description must be 1024 characters or fewer.', 'AGENT_DESCRIPTION_TOO_LONG'))
    }

    // ── Capabilities ─────────────────────────────────────────────────────
    const capSet = new Set<string>()
    for (const cap of agent.capabilities) {
        if (capSet.has(cap)) {
            issues.push(issue('capabilities', `Duplicate capability: "${cap}".`, 'AGENT_CAPABILITY_DUPLICATE'))
        }
        capSet.add(cap)
    }

    // Check against known capabilities catalog
    if (knownCapabilities && knownCapabilities.length > 0) {
        const knownNames = new Set(knownCapabilities.map((c) => c.name))
        for (const cap of agent.capabilities) {
            if (!knownNames.has(cap)) {
                issues.push(
                    issue('capabilities', `Unknown capability: "${cap}".`, 'AGENT_CAPABILITY_UNKNOWN', 'warning'),
                )
            }
        }

        // Forbidden combination check
        const capDefMap = new Map(knownCapabilities.map((c) => [c.name, c]))
        for (const cap of agent.capabilities) {
            const def = capDefMap.get(cap)
            if (def?.forbiddenWith) {
                for (const forbidden of def.forbiddenWith) {
                    if (capSet.has(forbidden)) {
                        issues.push(
                            issue(
                                'capabilities',
                                `Capability "${cap}" cannot be combined with "${forbidden}".`,
                                'AGENT_CAPABILITY_FORBIDDEN_COMBINATION',
                            ),
                        )
                    }
                }
            }
        }

        // Prerequisite check
        for (const cap of agent.capabilities) {
            const def = capDefMap.get(cap)
            if (def?.requires) {
                for (const req of def.requires) {
                    if (!capSet.has(req)) {
                        issues.push(
                            issue(
                                'capabilities',
                                `Capability "${cap}" requires "${req}" which is not declared.`,
                                'AGENT_CAPABILITY_MISSING_PREREQUISITE',
                            ),
                        )
                    }
                }
            }
        }
    }

    // ── Permissions ──────────────────────────────────────────────────────
    const permSet = new Set<string>()
    for (const perm of agent.permissions) {
        if (permSet.has(perm)) {
            issues.push(issue('permissions', `Duplicate permission: "${perm}".`, 'AGENT_PERMISSION_DUPLICATE'))
        }
        permSet.add(perm)
    }

    // ── Memory Config ────────────────────────────────────────────────────
    if (agent.memoryConfig.enabled) {
        if (!agent.memoryConfig.scopes || agent.memoryConfig.scopes.length === 0) {
            issues.push(
                issue(
                    'memoryConfig.scopes',
                    'Memory is enabled but no scopes are declared.',
                    'AGENT_MEMORY_NO_SCOPES',
                ),
            )
        }

        const validScopes = new Set(['working', 'session', 'long-term'])
        for (const scope of agent.memoryConfig.scopes) {
            if (!validScopes.has(scope)) {
                issues.push(
                    issue(
                        'memoryConfig.scopes',
                        `Invalid memory scope: "${scope}". Must be one of: working, session, long-term.`,
                        'AGENT_MEMORY_INVALID_SCOPE',
                    ),
                )
            }
        }

        if (
            agent.memoryConfig.maxEntriesPerScope !== undefined &&
            agent.memoryConfig.maxEntriesPerScope <= 0
        ) {
            issues.push(
                issue(
                    'memoryConfig.maxEntriesPerScope',
                    'Max entries per scope must be a positive number.',
                    'AGENT_MEMORY_INVALID_MAX_ENTRIES',
                ),
            )
        }
    }

    // ── Tools ────────────────────────────────────────────────────────────
    const toolNames = new Set<string>()
    for (let i = 0; i < agent.tools.length; i++) {
        const tool = agent.tools[i]!
        if (!tool.name || tool.name.trim().length === 0) {
            issues.push(issue(`tools[${i}].name`, 'Tool name is required.', 'AGENT_TOOL_NAME_REQUIRED'))
        } else {
            if (toolNames.has(tool.name)) {
                issues.push(
                    issue(`tools[${i}].name`, `Duplicate tool name: "${tool.name}".`, 'AGENT_TOOL_NAME_DUPLICATE'),
                )
            }
            toolNames.add(tool.name)
        }

        if (!tool.description || tool.description.trim().length === 0) {
            issues.push(
                issue(`tools[${i}].description`, 'Tool description is required.', 'AGENT_TOOL_DESCRIPTION_REQUIRED'),
            )
        }

        if (tool.timeoutMs !== undefined && tool.timeoutMs <= 0) {
            issues.push(
                issue(`tools[${i}].timeoutMs`, 'Tool timeout must be a positive number.', 'AGENT_TOOL_TIMEOUT_INVALID'),
            )
        }

        // Check that tool's required capabilities exist in agent
        if (tool.requiredCapabilities) {
            for (const rc of tool.requiredCapabilities) {
                if (!capSet.has(rc)) {
                    issues.push(
                        issue(
                            `tools[${i}].requiredCapabilities`,
                            `Tool "${tool.name}" requires capability "${rc}" which is not declared on the agent.`,
                            'AGENT_TOOL_CAPABILITY_MISSING',
                        ),
                    )
                }
            }
        }
    }

    // ── Skills ───────────────────────────────────────────────────────────
    const skillIds = new Set<string>()
    for (let i = 0; i < agent.skills.length; i++) {
        const skill = agent.skills[i]!
        if (skillIds.has(skill.id)) {
            issues.push(
                issue(`skills[${i}].id`, `Duplicate skill ID: "${skill.id}".`, 'AGENT_SKILL_DUPLICATE'),
            )
        }
        skillIds.add(skill.id)

        // Skill capability requirements must be satisfied by agent capabilities
        for (const reqCap of skill.requiredCapabilities) {
            if (!capSet.has(reqCap)) {
                issues.push(
                    issue(
                        `skills[${i}].requiredCapabilities`,
                        `Skill "${skill.name}" requires capability "${reqCap}" which is not declared on the agent.`,
                        'AGENT_SKILL_CAPABILITY_MISSING',
                    ),
                )
            }
        }
    }

    // ── Token Budget ─────────────────────────────────────────────────────
    if (agent.maxTokenBudget !== undefined && agent.maxTokenBudget <= 0) {
        issues.push(
            issue('maxTokenBudget', 'Max token budget must be a positive number.', 'AGENT_TOKEN_BUDGET_INVALID'),
        )
    }

    return {
        valid: issues.filter((i) => i.severity === 'error').length === 0,
        issues,
        checkedAt: new Date().toISOString(),
    }
}

// ─── Skill Validation ───────────────────────────────────────────────────────

export function validateSkillDefinition(
    skill: ISkillDefinitionDTO,
    knownCapabilities?: readonly ICapabilityDefinitionDTO[],
): IValidationResultDTO {
    const issues: IValidationIssue[] = []

    // ── Required fields ──────────────────────────────────────────────────
    if (!skill.id || skill.id.trim().length === 0) {
        issues.push(issue('id', 'Skill ID is required.', 'SKILL_ID_REQUIRED'))
    }

    if (!skill.name || skill.name.trim().length === 0) {
        issues.push(issue('name', 'Skill name is required.', 'SKILL_NAME_REQUIRED'))
    } else if (skill.name.length > 128) {
        issues.push(issue('name', 'Skill name must be 128 characters or fewer.', 'SKILL_NAME_TOO_LONG'))
    }

    if (!skill.version || skill.version.trim().length === 0) {
        issues.push(issue('version', 'Skill version is required.', 'SKILL_VERSION_REQUIRED'))
    } else if (!isValidSemver(skill.version)) {
        issues.push(issue('version', 'Skill version must be valid semver (e.g., 1.0.0).', 'SKILL_VERSION_INVALID'))
    }

    if (!skill.description || skill.description.trim().length === 0) {
        issues.push(issue('description', 'Skill description is required.', 'SKILL_DESCRIPTION_REQUIRED'))
    } else if (skill.description.length > 1024) {
        issues.push(issue('description', 'Skill description must be 1024 characters or fewer.', 'SKILL_DESCRIPTION_TOO_LONG'))
    }

    if (!skill.category || skill.category.trim().length === 0) {
        issues.push(issue('category', 'Skill category is required.', 'SKILL_CATEGORY_REQUIRED'))
    }

    // ── Required capabilities ────────────────────────────────────────────
    const capSet = new Set<string>()
    for (const cap of skill.requiredCapabilities) {
        if (capSet.has(cap)) {
            issues.push(issue('requiredCapabilities', `Duplicate required capability: "${cap}".`, 'SKILL_CAPABILITY_DUPLICATE'))
        }
        capSet.add(cap)
    }

    if (knownCapabilities && knownCapabilities.length > 0) {
        const knownNames = new Set(knownCapabilities.map((c) => c.name))
        for (const cap of skill.requiredCapabilities) {
            if (!knownNames.has(cap)) {
                issues.push(
                    issue('requiredCapabilities', `Unknown capability: "${cap}".`, 'SKILL_CAPABILITY_UNKNOWN', 'warning'),
                )
            }
        }
    }

    // ── Permissions ──────────────────────────────────────────────────────
    const permSet = new Set<string>()
    for (const perm of skill.permissions) {
        if (permSet.has(perm)) {
            issues.push(issue('permissions', `Duplicate permission: "${perm}".`, 'SKILL_PERMISSION_DUPLICATE'))
        }
        permSet.add(perm)
    }

    // ── Tools ────────────────────────────────────────────────────────────
    const toolNames = new Set<string>()
    for (let i = 0; i < skill.tools.length; i++) {
        const tool = skill.tools[i]!
        if (!tool.name || tool.name.trim().length === 0) {
            issues.push(issue(`tools[${i}].name`, 'Tool name is required.', 'SKILL_TOOL_NAME_REQUIRED'))
        } else {
            if (toolNames.has(tool.name)) {
                issues.push(
                    issue(`tools[${i}].name`, `Duplicate tool name: "${tool.name}".`, 'SKILL_TOOL_NAME_DUPLICATE'),
                )
            }
            toolNames.add(tool.name)
        }

        if (!tool.description || tool.description.trim().length === 0) {
            issues.push(
                issue(`tools[${i}].description`, 'Tool description is required.', 'SKILL_TOOL_DESCRIPTION_REQUIRED'),
            )
        }

        if (tool.timeoutMs !== undefined && tool.timeoutMs <= 0) {
            issues.push(
                issue(`tools[${i}].timeoutMs`, 'Tool timeout must be a positive number.', 'SKILL_TOOL_TIMEOUT_INVALID'),
            )
        }
    }

    return {
        valid: issues.filter((i) => i.severity === 'error').length === 0,
        issues,
        checkedAt: new Date().toISOString(),
    }
}
