/**
 * agent-templates.ts
 *
 * Bot templates are derived directly from the BUILTIN_MODULES registry in
 * `core/builtin-modules.ts`.  There is no separate hardcoded list — if you
 * add a new built-in module, it automatically appears as a bot template.
 *
 * External / downloadable templates will be fetched from the marketplace API
 * at runtime and merged in by the Bots tab UI.
 */

import { BUILTIN_MODULES } from '../../core/builtin-modules.js'
import type { IBuiltinAgentTemplate } from '../../core/builtin-modules.js'

/** A reusable bot type definition shown in the "Create bot" modal. */
export interface IAgentTemplate {
  /** Unique identifier — equals the module id for built-in templates. */
  id: string
  name: string
  description: string
  icon: string
  /** Tailwind colour class group (used on template cards). */
  colorClass: string
  /**
   * Labels for the 5 sequential execution steps shown in the live run panel.
   * Must always have exactly 5 entries.
   */
  execSteps: readonly [string, string, string, string, string]
}

/** Derive the full template list from the module registry at import time. */
export const AGENT_TEMPLATES: readonly IAgentTemplate[] = BUILTIN_MODULES.map((m) => ({
  id: m.id,
  name: m.agentTemplate.name,
  description: m.agentTemplate.description,
  icon: m.agentTemplate.icon,
  colorClass: m.agentTemplate.colorClass,
  execSteps: m.agentTemplate.execSteps,
}))

/** Look up a template by module id — O(n) but list is always tiny. */
export function findTemplate(id: string): IAgentTemplate | undefined {
  return AGENT_TEMPLATES.find((t) => t.id === id)
}

export type { IBuiltinAgentTemplate }
