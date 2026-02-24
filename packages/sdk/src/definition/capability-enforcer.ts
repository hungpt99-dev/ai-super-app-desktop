/**
 * CapabilityEnforcer — enforces capability rules at definition level.
 *
 * Rules:
 *   - Skill.requiredCapabilities ⊆ Agent.capabilities
 *   - Agent.capabilities must be explicitly declared
 *   - Cannot auto-inherit capability from skills
 *   - No hidden capability escalation
 *   - Marketplace imports must validate signature if present
 *   - Forbidden capability combinations are rejected
 *
 * This is pure validation — no runtime, no side effects.
 */

import type {
    IAgentDefinitionDTO,
    ISkillDefinitionDTO,
    ICapabilityDefinitionDTO,
    IValidationIssue,
    IValidationResultDTO,
} from '@agenthub/contracts'

// ─── Known Capability Catalog ───────────────────────────────────────────────

export const BUILTIN_CAPABILITIES: readonly ICapabilityDefinitionDTO[] = [
    {
        name: 'ai.generate',
        description: 'Generate AI text completions',
        scope: 'tool',
    },
    {
        name: 'ai.stream',
        description: 'Stream AI text completions',
        scope: 'tool',
    },
    {
        name: 'storage.read',
        description: 'Read from local storage',
        scope: 'memory',
    },
    {
        name: 'storage.write',
        description: 'Write to local storage',
        scope: 'memory',
        requires: ['storage.read'],
    },
    {
        name: 'memory.read',
        description: 'Read from memory store',
        scope: 'memory',
    },
    {
        name: 'memory.write',
        description: 'Write to memory store',
        scope: 'memory',
        requires: ['memory.read'],
    },
    {
        name: 'memory.shared-write',
        description: 'Write to shared workspace memory',
        scope: 'memory',
        dangerousPermission: true,
        requires: ['memory.write'],
    },
    {
        name: 'network.fetch',
        description: 'Make outbound HTTP requests',
        scope: 'network',
    },
    {
        name: 'computer.screenshot',
        description: 'Capture screenshots',
        scope: 'computer',
        dangerousPermission: true,
    },
    {
        name: 'computer.input',
        description: 'Control mouse and keyboard',
        scope: 'computer',
        dangerousPermission: true,
    },
    {
        name: 'computer.clipboard',
        description: 'Access system clipboard',
        scope: 'computer',
    },
    {
        name: 'computer.shell',
        description: 'Execute shell commands',
        scope: 'computer',
        dangerousPermission: true,
        forbiddenWith: ['sandbox.strict'],
    },
    {
        name: 'computer.files',
        description: 'Read and write local files',
        scope: 'filesystem',
        dangerousPermission: true,
    },
    {
        name: 'filesystem',
        description: 'Access local filesystem',
        scope: 'filesystem',
        dangerousPermission: true,
    },
    {
        name: 'agent.call',
        description: 'Call another agent',
        scope: 'agent_boundary',
    },
    {
        name: 'tool.execute',
        description: 'Execute a registered tool',
        scope: 'tool',
    },
    {
        name: 'events.publish',
        description: 'Publish events to the event bus',
        scope: 'network',
    },
    {
        name: 'events.subscribe',
        description: 'Subscribe to events',
        scope: 'network',
    },
    {
        name: 'ui.notify',
        description: 'Send notifications to the UI',
        scope: 'tool',
    },
    {
        name: 'ui.dashboard',
        description: 'Display dashboard panels',
        scope: 'tool',
    },
    {
        name: 'sandbox.strict',
        description: 'Strict sandbox mode — no shell access',
        scope: 'agent_boundary',
        forbiddenWith: ['computer.shell'],
    },
    {
        name: 'token_budget.unlimited',
        description: 'Unlimited token budget',
        scope: 'token_budget',
        dangerousPermission: true,
        forbiddenWith: ['token_budget.limited'],
    },
    {
        name: 'token_budget.limited',
        description: 'Limited token budget (enforced by policy)',
        scope: 'token_budget',
        forbiddenWith: ['token_budget.unlimited'],
    },
]

// ─── Enforcement Result ─────────────────────────────────────────────────────

export interface ICapabilityEnforcementResult {
    readonly allowed: boolean
    readonly issues: readonly IValidationIssue[]
    readonly escalations: readonly ICapabilityEscalation[]
}

export interface ICapabilityEscalation {
    readonly sourceSkillId: string
    readonly sourceSkillName: string
    readonly capabilityName: string
    readonly reason: string
}

// ─── Enforce Capabilities ───────────────────────────────────────────────────

/**
 * Enforce capability rules on an agent definition.
 * Must be called at definition level — before runtime.
 */
export function enforceCapabilities(
    agent: IAgentDefinitionDTO,
    capabilityCatalog: readonly ICapabilityDefinitionDTO[] = BUILTIN_CAPABILITIES,
): ICapabilityEnforcementResult {
    const issues: IValidationIssue[] = []
    const escalations: ICapabilityEscalation[] = []

    const agentCapSet = new Set(agent.capabilities)
    const capMap = new Map(capabilityCatalog.map((c) => [c.name, c]))

    // ── Rule 1: Agent capabilities must be explicitly declared ───────────
    // (This is inherent in the data structure — capabilities are a list)

    // ── Rule 2: Forbidden combinations ───────────────────────────────────
    for (const cap of agent.capabilities) {
        const def = capMap.get(cap)
        if (def?.forbiddenWith) {
            for (const forbidden of def.forbiddenWith) {
                if (agentCapSet.has(forbidden)) {
                    issues.push({
                        field: 'capabilities',
                        message: `Capability "${cap}" is forbidden with "${forbidden}".`,
                        severity: 'error',
                        code: 'CAPABILITY_FORBIDDEN_COMBINATION',
                    })
                }
            }
        }
    }

    // ── Rule 3: Prerequisites must be satisfied ──────────────────────────
    for (const cap of agent.capabilities) {
        const def = capMap.get(cap)
        if (def?.requires) {
            for (const req of def.requires) {
                if (!agentCapSet.has(req)) {
                    issues.push({
                        field: 'capabilities',
                        message: `Capability "${cap}" requires "${req}" which is not declared.`,
                        severity: 'error',
                        code: 'CAPABILITY_MISSING_PREREQUISITE',
                    })
                }
            }
        }
    }

    // ── Rule 4: Skill.requiredCapabilities ⊆ Agent.capabilities ─────────
    for (const skill of agent.skills) {
        for (const reqCap of skill.requiredCapabilities) {
            if (!agentCapSet.has(reqCap)) {
                issues.push({
                    field: `skills.${skill.id}.requiredCapabilities`,
                    message: `Skill "${skill.name}" requires capability "${reqCap}" not declared on the agent.`,
                    severity: 'error',
                    code: 'SKILL_CAPABILITY_NOT_GRANTED',
                })
            }
        }
    }

    // ── Rule 5: No hidden capability escalation ─────────────────────────
    // Detect if any skill implicitly tries to use capabilities not declared
    for (const skill of agent.skills) {
        for (const tool of skill.tools) {
            if (tool.requiredCapabilities) {
                for (const toolCap of tool.requiredCapabilities) {
                    if (!agentCapSet.has(toolCap)) {
                        escalations.push({
                            sourceSkillId: skill.id,
                            sourceSkillName: skill.name,
                            capabilityName: toolCap,
                            reason: `Tool "${tool.name}" in skill "${skill.name}" requires capability "${toolCap}" not declared on agent.`,
                        })
                        issues.push({
                            field: `skills.${skill.id}.tools.${tool.name}`,
                            message: `Hidden escalation: tool "${tool.name}" requires "${toolCap}" not declared on agent.`,
                            severity: 'error',
                            code: 'CAPABILITY_HIDDEN_ESCALATION',
                        })
                    }
                }
            }
        }
    }

    // ── Rule 6: Cannot auto-inherit capability ──────────────────────────
    // Skills cannot grant capabilities to agents — detect if skills declare
    // capabilities that could be mistaken as agent-granted
    const allSkillRequiredCaps = new Set(
        agent.skills.flatMap((s) => [...s.requiredCapabilities]),
    )
    for (const skillCap of allSkillRequiredCaps) {
        if (!agentCapSet.has(skillCap)) {
            // Already reported above but flagging auto-inherit attempt
            issues.push({
                field: 'capabilities',
                message: `Capability "${skillCap}" is required by attached skill(s) but not declared on agent. Capabilities cannot be auto-inherited.`,
                severity: 'error',
                code: 'CAPABILITY_AUTO_INHERIT_BLOCKED',
            })
        }
    }

    // ── Rule 7: Marketplace signature validation ────────────────────────
    for (const skill of agent.skills) {
        if (skill.signature !== undefined && skill.signature.trim().length === 0) {
            issues.push({
                field: `skills.${skill.id}.signature`,
                message: `Skill "${skill.name}" has an empty signature. Signature must be valid if present.`,
                severity: 'error',
                code: 'SKILL_SIGNATURE_EMPTY',
            })
        }
    }

    if (agent.signature !== undefined && agent.signature.trim().length === 0) {
        issues.push({
            field: 'signature',
            message: 'Agent has an empty signature. Signature must be valid if present.',
            severity: 'error',
            code: 'AGENT_SIGNATURE_EMPTY',
        })
    }

    // Deduplicate issues by code + field
    const seen = new Set<string>()
    const deduped = issues.filter((iss) => {
        const key = `${iss.code}:${iss.field}:${iss.message}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })

    return {
        allowed: deduped.filter((i) => i.severity === 'error').length === 0,
        issues: deduped,
        escalations,
    }
}

// ─── Validate Skill Attachment ──────────────────────────────────────────────

/**
 * Check if a skill can be attached to an agent definition.
 * Returns issues preventing attachment.
 */
export function validateSkillAttachment(
    agent: IAgentDefinitionDTO,
    skill: ISkillDefinitionDTO,
    capabilityCatalog: readonly ICapabilityDefinitionDTO[] = BUILTIN_CAPABILITIES,
): IValidationResultDTO {
    const issues: IValidationIssue[] = []
    const agentCapSet = new Set(agent.capabilities)

    // Check duplicate
    if (agent.skills.some((s) => s.id === skill.id)) {
        issues.push({
            field: 'skills',
            message: `Skill "${skill.name}" (${skill.id}) is already attached to this agent.`,
            severity: 'error',
            code: 'SKILL_ALREADY_ATTACHED',
        })
    }

    // Check capability requirements
    for (const reqCap of skill.requiredCapabilities) {
        if (!agentCapSet.has(reqCap)) {
            issues.push({
                field: 'skills.requiredCapabilities',
                message: `Skill "${skill.name}" requires capability "${reqCap}" not declared on agent. Add it to the agent's capabilities first.`,
                severity: 'error',
                code: 'SKILL_CAPABILITY_NOT_SATISFIED',
            })
        }
    }

    // Check tool name conflicts
    const existingToolNames = new Set([
        ...agent.tools.map((t) => t.name),
        ...agent.skills.flatMap((s) => s.tools.map((t) => t.name)),
    ])
    for (const tool of skill.tools) {
        if (existingToolNames.has(tool.name)) {
            issues.push({
                field: 'skills.tools',
                message: `Tool name "${tool.name}" from skill "${skill.name}" conflicts with existing tool.`,
                severity: 'error',
                code: 'SKILL_TOOL_NAME_CONFLICT',
            })
        }
    }

    // Signature check
    if (skill.signature !== undefined && skill.signature.trim().length === 0) {
        issues.push({
            field: 'skills.signature',
            message: `Skill "${skill.name}" has an invalid (empty) signature.`,
            severity: 'error',
            code: 'SKILL_SIGNATURE_INVALID',
        })
    }

    return {
        valid: issues.filter((i) => i.severity === 'error').length === 0,
        issues,
        checkedAt: new Date().toISOString(),
    }
}
