/**
 * FeatureGrid.tsx — "Agents" tab (thin shell)
 *
 * Layout
 * ──────
 * 1. All Agent Types  — one card per template; shows agent count and "+ Add Agent" CTA.
 * 2. My Agents        — flat list of all agent instances (newest-first).
 *
 * Modals live in components/dialogs/:
 *   - CreateAgentModal  — 2-step wizard (pick type → configure)
 *   - SideloadAgentModal — dev-mode package installer
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useAgentsStore, type IDesktopAgent } from '../../store/agents-store.js'
import { AGENT_TEMPLATES, type IAgentTemplate } from '../../store/agent-templates.js'
import { useAgentTypesStore } from '../../store/agent-types-store.js'
import { useDevSettingsStore } from '../../store/dev/dev-settings-store.js'
import { useDevSideloadStore } from '../../store/dev/dev-sideload-store.js'
import { CreateAgentModal } from '../dialogs/CreateAgentModal.js'
import { SideloadAgentModal } from '../dialogs/SideloadAgentModal.js'

// ─── Props ────────────────────────────────────────────────────────────────────

interface IFeatureGridProps {
  onOpenModule: (moduleId: string) => void
}

// ─── Agent instance row ─────────────────────────────────────────────────────────

interface IAgentInstanceRowProps {
  agent: IDesktopAgent
  runningAgentIds: string[]
  templateIcon?: string
  templateName?: string
  onOpen: (id: string) => void
}

function AgentInstanceRow({ agent, runningAgentIds, templateIcon, templateName, onOpen }: IAgentInstanceRowProps): React.JSX.Element {
  const isRunning = runningAgentIds.includes(agent.id)

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 transition-colors hover:border-[var(--color-accent)]/40">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${isRunning
            ? 'animate-pulse bg-blue-400'
            : agent.status === 'active'
              ? 'bg-[var(--color-success)]'
              : 'bg-yellow-400'
          }`}
      />
      {templateIcon && <span className="shrink-0 text-base">{templateIcon}</span>}
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-primary)]">
        {agent.name}
      </span>
      {templateName && (
        <span className="hidden shrink-0 rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] sm:inline">
          {templateName}
        </span>
      )}
      {agent.synced && (
        <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]" title="Cloud synced">☁</span>
      )}
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${agent.status === 'active'
            ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
            : 'bg-yellow-400/15 text-yellow-400'
          }`}
      >
        {agent.status}
      </span>
      <button
        onClick={() => { onOpen(agent.id) }}
        className="shrink-0 rounded-lg bg-[var(--color-accent-dim)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
      >
        ▶ Open
      </button>
    </div>
  )
}

// ─── Agent type card ────────────────────────────────────────────────────────────

interface IAgentTypeCardProps {
  icon: string
  label: string
  description: string
  badge: string
  badgeClass: string
  /** undefined = built-in agent (no user instances); 0+ = agent agent type */
  agentCount?: number
  runningCount?: number
  /** true when the built-in panel is currently open */
  isActive?: boolean
  onAction: () => void
}

function AgentTypeCard({
  icon, label, description, badge, badgeClass,
  agentCount, runningCount = 0, isActive = false, onAction,
}: IAgentTypeCardProps): React.JSX.Element {
  const isTool = agentCount === undefined
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-[var(--color-surface)] p-5 transition-all ${isActive
          ? 'border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent-dim)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-[0_0_0_1px_var(--color-accent-dim)]'
        }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-2xl">
          {icon}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
            {badge}
          </span>
          {!isTool && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {String(agentCount)} agent{agentCount !== 1 ? 's' : ''}
            </span>
          )}
          {runningCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-blue-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
              {String(runningCount)} running
            </span>
          )}
        </div>
      </div>

      <h3 className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">{label}</h3>
      <p className="mb-4 flex-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">{description}</p>

      <button
        onClick={onAction}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${isActive
            ? 'bg-emerald-950/50 text-emerald-400 hover:bg-emerald-900/50'
            : 'bg-[var(--color-accent-dim)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white'
          }`}
      >
        {isTool
          ? (isActive ? '● Open' : '→ Open')
          : '+ Add Agent'}
      </button>
    </div>
  )
}

// ─── FeatureGrid (Agents tab) ───────────────────────────────────────────────────

/**
 * FeatureGrid — the Agents tab.
 * Agent types (templates) are the primary organisational unit.
 * Each type card is expandable and shows all its agent instances.
 * One agent type can power any number of agents with different names and configurations.
 */
export function FeatureGrid({ onOpenModule }: IFeatureGridProps): React.JSX.Element {
  const agents = useAgentsStore((s) => s.agents)
  const runningAgentIds = useAgentsStore((s) => s.runningAgentIds)
  const installedTypeIds = useAgentTypesStore((s) => s.installedTypeIds)
  const devEnabled = useDevSettingsStore((s) => s.enabled)
  const sideloadedModules = useDevSideloadStore((s) => s.modules)
  const removeSideloaded = useDevSideloadStore((s) => s.removeModule)

  // All agent types = built-in + installed hub types + dev-sideloaded modules
  const allTemplates = useMemo<IAgentTemplate[]>(() => [
    ...AGENT_TEMPLATES,
    ...AGENT_TEMPLATES.filter((t) => installedTypeIds.includes(t.id)),
    ...(devEnabled ? sideloadedModules : []),
  ].filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i), [installedTypeIds, devEnabled, sideloadedModules])

  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createTemplate, setCreateTpl] = useState<string | undefined>(undefined)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => { void useAgentsStore.getState().loadAgents() }, [])

  const openCreate = (templateId?: string): void => {
    setCreateTpl(templateId)
    setShowCreate(true)
  }

  // Group agents by templateId — used for agent count on type cards.
  const agentsByTemplate = useMemo<Record<string, IDesktopAgent[]>>(() => {
    const map: Record<string, IDesktopAgent[]> = {}
    for (const t of allTemplates) map[t.id] = []
    for (const agent of agents) {
      if (agent.templateId !== undefined && agent.templateId in map) {
        const bucket = map[agent.templateId]
        if (bucket !== undefined) bucket.push(agent)
      }
    }
    return map
  }, [agents, allTemplates])

  // All agents sorted newest-first for the flat "My Agents" list.
  const allAgents = useMemo(
    () => [...agents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [agents],
  )

  // Search filtering.
  const q = search.toLowerCase()

  const visibleTemplates = search.length === 0
    ? allTemplates
    : allTemplates.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q),
    )

  const visibleAllAgents = search.length === 0
    ? allAgents
    : allAgents.filter((a) => {
      const tmpl = a.templateId ? allTemplates.find((t) => t.id === a.templateId) : undefined
      return (
        a.name.toLowerCase().includes(q) ||
        (tmpl?.name.toLowerCase().includes(q) ?? false)
      )
    })

  const isEmpty = visibleTemplates.length === 0 && visibleAllAgents.length === 0

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">

      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Agents</h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Create multiple agents from the same type, each with its own name.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {devEnabled && (
              <button
                onClick={() => { setShowImport(true) }}
                title="Sideload a compiled agent package (.js) — dev mode"
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-700/60 bg-amber-900/20 px-3 py-2 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-900/40"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Sideload Agent
              </button>
            )}
            <button
              onClick={() => { openCreate() }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              + New Agent
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-8">

          {/* Search */}
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search agent types or agents…"
              value={search}
              onChange={(e) => { setSearch(e.target.value) }}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* All Agent Types */}
          {visibleTemplates.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  All Agent Types
                </p>
                <button
                  type="button"
                  onClick={() => { onOpenModule('hub') }}
                  className="text-[10px] text-[var(--color-accent)] hover:underline"
                >
                  Browse more →
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {visibleTemplates.map((template) => {
                  const typeAgents = agentsByTemplate[template.id] ?? []
                  const runningCount = typeAgents.filter((a) => runningAgentIds.includes(a.id)).length
                  const isDevImported = devEnabled && sideloadedModules.some((d) => d.id === template.id)
                  return (
                    <div key={template.id} className="relative">
                      <AgentTypeCard
                        icon={template.icon}
                        label={template.name}
                        description={template.description}
                        badge={isDevImported ? '📦 Sideloaded' : template.name}
                        badgeClass={isDevImported ? 'bg-amber-900/40 text-amber-400' : template.colorClass}
                        agentCount={typeAgents.length}
                        runningCount={runningCount}
                        onAction={() => { openCreate(template.id) }}
                      />
                      {isDevImported && (
                        <button
                          title="Remove sideloaded module"
                          onClick={() => { void removeSideloaded(template.id) }}
                          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[10px] text-[var(--color-text-muted)] opacity-0 transition-opacity hover:bg-red-900/40 hover:text-red-400 [.relative:hover_&]:opacity-100"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* My Agents — flat list of all agent instances (newest first) */}
          {visibleAllAgents.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                My Agents
              </p>
              <div className="space-y-2">
                {visibleAllAgents.map((agent) => {
                  const tmpl = agent.templateId ? allTemplates.find((t) => t.id === agent.templateId) : undefined
                  return (
                    <AgentInstanceRow
                      key={agent.id}
                      agent={agent}
                      runningAgentIds={runningAgentIds}
                      templateIcon={tmpl?.icon ?? '✏️'}
                      templateName={tmpl?.name ?? 'Custom'}
                      onOpen={onOpenModule}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {/* Empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-2xl">🔍</p>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No results for &quot;{search}&quot;.</p>
              <button
                onClick={() => { setSearch('') }}
                className="mt-3 text-xs text-[var(--color-accent)] hover:underline"
              >
                Clear search
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Dev mode: sideloaded module count banner */}
      {devEnabled && sideloadedModules.length > 0 && (
        <div className="shrink-0 border-t border-amber-900/30 bg-amber-950/20 px-8 py-2">
          <p className="text-[11px] text-amber-400">
            📦 {String(sideloadedModules.length)} sideloaded agent package{sideloadedModules.length !== 1 ? 's' : ''} active.
            {' '}
            <button onClick={() => { setShowImport(true) }} className="underline hover:no-underline">Manage</button>
          </p>
        </div>
      )}

      {/* Create Agent wizard */}
      {showCreate && (
        <CreateAgentModal
          allTemplates={allTemplates}
          {...(createTemplate !== undefined ? { initialTemplateId: createTemplate } : {})}
          onClose={() => { setShowCreate(false); setCreateTpl(undefined) }}
        />
      )}

      {/* Dev mode: Sideload Agent Package modal */}
      {showImport && (
        <SideloadAgentModal onClose={() => { setShowImport(false) }} />
      )}
    </div>
  )
}
