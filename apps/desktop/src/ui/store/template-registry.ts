/**
 * template-registry.ts
 *
 * Single source of truth for all agent templates — built-in + imported.
 * Replaces agent-templates.ts and agent-types-store.ts.
 *
 * Templates are read-only blueprints. Users create agent instances from them.
 * A template can be instantiated multiple times as different agents.
 */

import { create } from 'zustand'
import { BUILTIN_MODULES } from '../../app/builtin-modules.js'
import type { IBuiltinAgentTemplate } from '../../app/builtin-modules.js'
import { safeJsonParse } from '../../bridges/runtime.js'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TemplateSource = 'builtin' | 'imported' | 'marketplace'

export interface IAgentDefaultConfig {
    model?: string | undefined
    temperature?: number | undefined
    maxTokens?: number | undefined
    systemPrompt?: string | undefined
}

export interface ITemplateTool {
    name: string
    description: string
    inputSchema?: Record<string, unknown> | undefined
}

export interface IAgentTemplate {
    id: string
    name: string
    description: string
    icon: string
    category: string
    colorClass: string
    author?: string | undefined
    tags?: string[] | undefined
    source: TemplateSource
    config: IAgentDefaultConfig
    tools: ITemplateTool[]
    execSteps: readonly [string, string, string, string, string] | string[]
    importedAt?: string | undefined
    sourceUrl?: string | undefined
}

// ─── Import schema ─────────────────────────────────────────────────────────────

/** Shape of the `.agenthub.json` import file. */
export interface IAgentTemplateFile {
    $schema?: string
    version: string
    template: {
        id: string
        name: string
        description: string
        icon?: string
        category?: string
        author?: string
        tags?: string[]
        config?: IAgentDefaultConfig
        tools?: ITemplateTool[]
        execSteps?: string[]
    }
}

// ─── Validation ────────────────────────────────────────────────────────────────

export interface ITemplateValidationResult {
    valid: boolean
    errors: string[]
}

export function validateTemplateFile(data: unknown): ITemplateValidationResult {
    const errors: string[] = []

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Invalid JSON: expected an object'] }
    }

    const file = data as Record<string, unknown>

    if (!file.version || typeof file.version !== 'string') {
        errors.push('Missing or invalid "version" field')
    }

    if (!file.template || typeof file.template !== 'object') {
        errors.push('Missing or invalid "template" field')
        return { valid: false, errors }
    }

    const t = file.template as Record<string, unknown>

    if (!t.id || typeof t.id !== 'string') errors.push('template.id must be a non-empty string')
    if (!t.name || typeof t.name !== 'string') errors.push('template.name must be a non-empty string')
    if (!t.description || typeof t.description !== 'string') errors.push('template.description must be a non-empty string')

    if (t.config !== undefined && typeof t.config !== 'object') {
        errors.push('template.config must be an object')
    }

    if (t.tools !== undefined && !Array.isArray(t.tools)) {
        errors.push('template.tools must be an array')
    }

    return { valid: errors.length === 0, errors }
}

// ─── Built-in derivation ───────────────────────────────────────────────────────

const DEFAULT_EXEC_STEPS: readonly [string, string, string, string, string] = [
    'Initialising task…',
    'Processing task…',
    'Executing with AI…',
    'Reviewing output…',
    'Completing run…',
]

function deriveBuiltinTemplates(): IAgentTemplate[] {
    return BUILTIN_MODULES.map((m) => ({
        id: m.id,
        name: m.agentTemplate.name,
        description: m.agentTemplate.description,
        icon: m.agentTemplate.icon,
        category: m.definition.manifest.category ?? 'general',
        colorClass: m.agentTemplate.colorClass,
        author: m.definition.manifest.author,
        tags: m.definition.manifest.tags ? [...m.definition.manifest.tags] : undefined,
        source: 'builtin' as const,
        config: {},
        tools: m.definition.tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
        })),
        execSteps: m.agentTemplate.execSteps,
    }))
}

// ─── Persistence ───────────────────────────────────────────────────────────────

const IMPORTED_KEY = 'agenthub:imported-templates'

function readImported(): IAgentTemplate[] {
    return safeJsonParse<IAgentTemplate[]>(localStorage.getItem(IMPORTED_KEY), [])
}

function writeImported(templates: IAgentTemplate[]): void {
    try {
        localStorage.setItem(IMPORTED_KEY, JSON.stringify(templates))
    } catch { /* ignore */ }
}

// ─── Store ─────────────────────────────────────────────────────────────────────

interface ITemplateRegistryStore {
    /** All available templates (builtin + imported). */
    templates: IAgentTemplate[]

    /** Import a template from a parsed JSON file. */
    importTemplate: (file: IAgentTemplateFile, sourceUrl?: string) => ITemplateValidationResult & { templateId?: string | undefined }

    /** Remove an imported template by ID. Built-in templates cannot be removed. */
    removeTemplate(id: string): boolean

    /** Get a template by ID. */
    getTemplate(id: string): IAgentTemplate | undefined

    /** List templates by source. */
    listBySource(source: TemplateSource): IAgentTemplate[]

    /** Refresh built-in templates (e.g. after module registration). */
    refresh(): void
}

function buildAll(imported: IAgentTemplate[]): IAgentTemplate[] {
    return [...deriveBuiltinTemplates(), ...imported]
}

export const useTemplateRegistry = create<ITemplateRegistryStore>((set, get) => ({
    templates: buildAll(readImported()),

    importTemplate: (file, sourceUrl) => {
        const validation = validateTemplateFile(file)
        if (!validation.valid) return { ...validation }

        const t = file.template
        const existing = get().templates.find((x) => x.id === t.id)
        if (existing) {
            return { valid: false, errors: [`Template "${t.id}" already exists (source: ${existing.source})`] }
        }

        const template: IAgentTemplate = {
            id: t.id,
            name: t.name,
            description: t.description,
            icon: t.icon ?? '🤖',
            category: t.category ?? 'general',
            colorClass: 'bg-blue-500/10 text-blue-400',
            author: t.author,
            tags: t.tags,
            source: 'imported',
            config: t.config ?? {},
            tools: (t.tools ?? []).map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
            })),
            execSteps: t.execSteps ?? [...DEFAULT_EXEC_STEPS],
            importedAt: new Date().toISOString(),
            sourceUrl,
        }

        const imported = [...readImported(), template]
        writeImported(imported)
        set({ templates: buildAll(imported) })

        return { valid: true, errors: [], templateId: template.id }
    },

    removeTemplate: (id) => {
        const template = get().templates.find((t) => t.id === id)
        if (!template || template.source === 'builtin') return false

        const imported = readImported().filter((t) => t.id !== id)
        writeImported(imported)
        set({ templates: buildAll(imported) })
        return true
    },

    getTemplate: (id) => get().templates.find((t) => t.id === id),

    listBySource: (source) => get().templates.filter((t) => t.source === source),

    refresh: () => {
        set({ templates: buildAll(readImported()) })
    },
}))

// ─── Backward compat re-exports ────────────────────────────────────────────────

/** @deprecated Use useTemplateRegistry().templates instead */
export const AGENT_TEMPLATES = deriveBuiltinTemplates()

/** @deprecated Use useTemplateRegistry().getTemplate() instead */
export function findTemplate(id: string): IAgentTemplate | undefined {
    return useTemplateRegistry.getState().getTemplate(id)
}

export type { IBuiltinAgentTemplate }
