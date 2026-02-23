/**
 * DashboardPanel.tsx
 *
 * App home screen.  Shows:
 *  • Stats overview  (total agents, active agents, total runs, API keys configured)
 *  • Default run key selector  (which provider to use for local agent runs)
 *  • Recent activity           (latest runs across all agents)
 *  • Agent template gallery    (quick-create any number of agents from a template)
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useAgentsStore, type IDesktopAgentRun } from '../../store/agents-store.js'
import { useAuthStore } from '../../store/auth-store.js'
import type { AppView } from '../../store/app-store.js'
import {
  listAPIKeys,
  getDefaultKeyId,
  setDefaultKeyId as persistDefaultKeyId,
  type ILocalAPIKey,
} from '../../../bridges/api-key-store.js'
import {
  useTemplateRegistry,
  type IAgentTemplate,
} from '../../store/template-registry.js'

// ─── Provider meta ────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, { label: string; icon: string }> = {
  openai: { label: 'OpenAI', icon: '🤖' },
  anthropic: { label: 'Anthropic', icon: '🧠' },
  google: { label: 'Google Gemini', icon: '✨' },
  mistral: { label: 'Mistral AI', icon: '💨' },
  cohere: { label: 'Cohere', icon: '🔮' },
  groq: { label: 'Groq', icon: '⚡' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${String(Math.floor(ms / 60_000))}m ago`
  if (ms < 86_400_000) return `${String(Math.floor(ms / 3_600_000))}h ago`
  return new Date(iso).toLocaleDateString()
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface IStatCardProps {
  icon: string
  label: string
  value: number
  accent?: string
}

function StatCard({ icon, label, value, accent = 'text-[var(--color-accent)]' }: IStatCardProps): React.JSX.Element {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${accent}`}>{String(value)}</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{label}</p>
    </div>
  )
}

// ─── Default run key selector ─────────────────────────────────────────────────

interface IDefaultKeyCardProps {
  keys: ILocalAPIKey[]
  defaultKeyId: string | null
  onSetDefault: (keyId: string | null) => void
  onGoToKeys: () => void
}

function DefaultKeyCard({
  keys, defaultKeyId, onSetDefault, onGoToKeys,
}: IDefaultKeyCardProps): React.JSX.Element {
  const activeKeys = keys.filter((k) => k.isActive)

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Default Run Key</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            API key used when running agents locally without a cloud account.
          </p>
        </div>
        <button
          onClick={onGoToKeys}
          className="shrink-0 text-xs text-[var(--color-accent)] hover:underline"
        >
          Manage keys →
        </button>
      </div>

      {activeKeys.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-3">
          <span className="text-base">🔑</span>
          <p className="text-xs text-[var(--color-text-secondary)]">
            No API keys added yet.{' '}
            <button onClick={onGoToKeys} className="text-[var(--color-accent)] hover:underline">
              Add one
            </button>{' '}
            to run agents locally with AI.
          </p>
        </div>
      ) : (
        <select
          value={defaultKeyId ?? ''}
          onChange={(e) => { onSetDefault(e.target.value !== '' ? e.target.value : null) }}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]
                     px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none
                     focus:border-[var(--color-accent)]"
        >
          <option value="">⛔ None — offline mode</option>
          {activeKeys.map((k) => {
            const meta = PROVIDER_LABELS[k.provider]
            const display = k.label.length > 0
              ? `${k.label} (${meta?.label ?? k.provider})`
              : (meta?.label ?? k.provider)
            return (
              <option key={k.id} value={k.id}>
                {meta?.icon ?? '🔑'} {display}
              </option>
            )
          })}
        </select>
      )}

      {defaultKeyId && (() => {
        const key = activeKeys.find((k) => k.id === defaultKeyId)
        const meta = key ? PROVIDER_LABELS[key.provider] : undefined
        const display = key
          ? (key.label.length > 0
            ? `${key.label} (${meta?.label ?? key.provider})`
            : (meta?.label ?? key.provider))
          : defaultKeyId
        return (
          <p className="mt-2 text-[11px] text-[var(--color-success)]">
            ✓ Agents will use <strong>{display}</strong> by default when run locally.
          </p>
        )
      })()}
    </div>
  )
}

// ─── Recent activity row ──────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-yellow-400',
  running: 'animate-pulse bg-blue-400',
  completed: 'bg-[var(--color-success)]',
  failed: 'bg-[var(--color-danger)]',
  cancelled: 'bg-[var(--color-text-muted)]',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-400/15 text-yellow-400',
  running: 'bg-blue-400/15 text-blue-400',
  completed: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  failed: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
  cancelled: 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]',
}

interface IActivityRowProps {
  run: IDesktopAgentRun
  agentName: string
  onOpenAgent: () => void
}

function ActivityRow({ run, agentName, onOpenAgent }: IActivityRowProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[run.status] ?? ''}`} />
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-primary)]">
        {agentName}
      </span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[run.status] ?? ''}`}>
        {run.status}
      </span>
      <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
        {relativeTime(run.started_at)}
      </span>
      <button
        onClick={onOpenAgent}
        className="shrink-0 text-xs text-[var(--color-accent)] hover:underline"
      >
        Open
      </button>
    </div>
  )
}

// ─── Template card ────────────────────────────────────────────────────────────

interface ITemplateCardProps {
  template: IAgentTemplate
  instanceCount: number
  onCreate: (template: IAgentTemplate) => void
}

function TemplateCard({ template, instanceCount, onCreate }: ITemplateCardProps): React.JSX.Element {
  const colorClass = template.colorClass

  return (
    <div
      className="group flex flex-col rounded-2xl border border-[var(--color-border)]
                 bg-[var(--color-surface)] p-5 transition-all
                 hover:border-[var(--color-accent)] hover:shadow-[0_0_0_1px_var(--color-accent-dim)]"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-2xl">
          {template.icon}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${colorClass}`}>
          {template.name}
        </span>
      </div>

      <h3 className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">
        {template.name}
      </h3>
      <p className="mb-4 flex-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {template.description}
      </p>

      <div className="flex items-center justify-between">
        <button
          onClick={() => { onCreate(template) }}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-dim)]
                     px-3 py-1.5 text-xs font-medium text-[var(--color-accent)]
                     transition-colors hover:bg-[var(--color-accent)] hover:text-white"
        >
          + Create agent
        </button>
        {instanceCount > 0 && (
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {String(instanceCount)} agent{instanceCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Create from template modal ───────────────────────────────────────────────

interface ICreateFromTemplateModalProps {
  template: IAgentTemplate
  instanceCount: number
  onClose: () => void
  onCreated: (agentId: string) => void
}

function CreateFromTemplateModal({
  template, instanceCount, onClose, onCreated,
}: ICreateFromTemplateModalProps): React.JSX.Element {
  const defaultName = instanceCount === 0 ? template.name : `${template.name} #${String(instanceCount + 1)}`
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await useAgentsStore.getState().createAgent({
        name: name.trim(),
        description: template.description,
        templateId: template.id,
      })
      // Find the newly-created agent (first in list after creation).
      const newAgent = useAgentsStore.getState().agents[0]
      if (newAgent) onCreated(newAgent.id)
      else onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      // Also push a persistent error toast so it's visible outside the modal.
      void import('../../store/app-store.js').then(({ useAppStore }) => {
        useAppStore.getState().pushNotification({ level: 'error', title: 'Failed to create agent', body: msg })
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-2xl">
            {template.icon}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              New agent from "{template.name}"
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">{template.description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Agent name *</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value) }}
              required
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]
                         px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none
                         focus:border-[var(--color-accent)]"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm
                         text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium
                         text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── DashboardPanel ───────────────────────────────────────────────────────────

export interface IDashboardPanelProps {
  onNavigate: (view: AppView) => void
}

/**
 * DashboardPanel — the app home screen.
 * Stats · Default run key · Recent activity · Agent template gallery.
 */
export function DashboardPanel({ onNavigate }: IDashboardPanelProps): React.JSX.Element {
  const { user } = useAuthStore()
  const agents = useAgentsStore((s) => s.agents)
  const runs = useAgentsStore((s) => s.runs)

  const [apiKeys, setApiKeys] = useState<ILocalAPIKey[]>([])
  const [defaultKeyId, setDefaultKeyId] = useState<string | null>(null)
  const [activeTemplate, setActiveTemplate] = useState<IAgentTemplate | null>(null)

  // Load API keys + default key on mount.
  useEffect(() => {
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const [keys, def]: [ILocalAPIKey[], string | null] = await Promise.all([listAPIKeys(), getDefaultKeyId()])
      setApiKeys(keys)
      setDefaultKeyId(def)
    })()
    void useAgentsStore.getState().loadAgents()
  }, [])

  // ── Derived stats ────────────────────────────────────────────────────────────
  const activeAgents = agents.filter((b) => b.status === 'active').length
  const activeKeys = apiKeys.filter((k) => k.isActive).length
  const totalRuns = Object.values(runs).reduce((sum, rs) => sum + rs.length, 0)

  // Flatten + sort all runs; take the latest 8 for the activity feed.
  const recentRuns = Object.entries(runs)
    .flatMap(([agentId, rs]) => rs.map((r) => ({ ...r, agent_id: agentId })))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 8)

  const handleSetDefault = useCallback((keyId: string | null) => {
    setDefaultKeyId(keyId)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    void persistDefaultKeyId(keyId)
  }, [])

  const handleOpenAgent = useCallback((agentId: string) => {
    useAgentsStore.getState().selectAgent(agentId)
    onNavigate('agent-run')
  }, [onNavigate])

  const handleTemplateCreated = useCallback((agentId: string) => {
    setActiveTemplate(null)
    useAgentsStore.getState().selectAgent(agentId)
    onNavigate('agent-run')
  }, [onNavigate])

  const greeting = user
    ? `Welcome back, ${user.name.split(' ')[0] ?? user.name}!`
    : 'Welcome!'

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Dashboard</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{greeting}</p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-8 py-7">
        <div className="mx-auto max-w-4xl space-y-8">

          {/* ── Stats row ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon="🤖" label="Total Agents" value={agents.length} />
            <StatCard icon="⚡" label="Active Agents" value={activeAgents} accent="text-[var(--color-success)]" />
            <StatCard icon="▶" label="Total Runs" value={totalRuns} accent="text-blue-400" />
            <StatCard icon="🔑" label="API Keys" value={activeKeys} accent="text-yellow-400" />
          </div>

          {/* ── Default run key ────────────────────────────────────────────── */}
          <DefaultKeyCard
            keys={apiKeys}
            defaultKeyId={defaultKeyId}
            onSetDefault={handleSetDefault}
            onGoToKeys={() => { onNavigate('api-keys') }}
          />

          {/* ── Recent activity ────────────────────────────────────────────── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Recent Activity
              </p>
              {agents.length > 0 && (
                <button
                  onClick={() => { onNavigate('activity') }}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  View all activity →
                </button>
              )}
            </div>

            {recentRuns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-12 text-center">
                <p className="text-3xl">📋</p>
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                  No runs yet — create an agent and hit Run to get started.
                </p>
                <button
                  onClick={() => { onNavigate('agents') }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-accent-dim)]
                             px-4 py-2 text-sm font-medium text-[var(--color-accent)]
                             transition-colors hover:bg-[var(--color-accent)] hover:text-white"
                >
                  Go to Agents
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRuns.map((run) => {
                  const agent = agents.find((b) => b.id === run.agent_id)
                  return (
                    <ActivityRow
                      key={run.id}
                      run={run}
                      agentName={agent?.name ?? 'Unknown agent'}
                      onOpenAgent={() => { handleOpenAgent(run.agent_id) }}
                    />
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Agent templates ──────────────────────────────────────────────── */}
          <section>
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Create from Template
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Each template can be instantiated multiple times with different names.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {useTemplateRegistry.getState().templates.map((template) => {
                const instanceCount = agents.filter((b) => b.templateId === template.id).length
                return (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    instanceCount={instanceCount}
                    onCreate={setActiveTemplate}
                  />
                )
              })}
            </div>
          </section>

        </div>
      </div>

      {/* Create-from-template modal */}
      {activeTemplate && (
        <CreateFromTemplateModal
          template={activeTemplate}
          instanceCount={agents.filter((b) => b.templateId === activeTemplate.id).length}
          onClose={() => { setActiveTemplate(null) }}
          onCreated={handleTemplateCreated}
        />
      )}
    </div>
  )
}
