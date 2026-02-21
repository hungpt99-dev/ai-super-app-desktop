/**
 * FeatureGrid.tsx — "Bots" tab
 *
 * Layout
 * ──────
 * 1. All Bot Types  — one card per template; shows bot count and "+ Add Bot" CTA.
 * 2. My Bots        — flat list of all bot instances (newest-first).
 *
 * Creating a bot is a 2-step wizard:
 *   Step 1 — Pick a bot type (required; or choose "Custom").
 *   Step 2 — Customise name + description (pre-filled from the type).
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useBotStore, type IDesktopBot } from '../store/bot-store.js'
import { useAuthStore } from '../store/auth-store.js'
import {
  BOT_TEMPLATES,
  BOT_TYPE_CATALOG,
  TEMPLATE_CATEGORY_COLORS,
  type IBotTemplate,
} from '../store/bot-templates.js'
import { useBotTypeStore } from '../store/bot-type-store.js'


const CUSTOM_TYPE_ID = '__custom__'

// ─── Props ────────────────────────────────────────────────────────────────────

interface IFeatureGridProps {
  onOpenModule: (moduleId: string) => void
}

// ─── 2-step Create Bot Modal ──────────────────────────────────────────────────

type CreateStep = 'pick-type' | 'configure'

interface ICreateBotModalProps {
  /** Pre-select this template and jump straight to step 2. */
  initialTemplateId?: string
  /** All available templates (built-in + installed from store). */
  allTemplates: IBotTemplate[]
  onClose: () => void
}

function CreateBotModal({ initialTemplateId, allTemplates, onClose }: ICreateBotModalProps): React.JSX.Element {
  const startAtConfigure = initialTemplateId !== undefined
  const [step, setStep]        = useState<CreateStep>(startAtConfigure ? 'configure' : 'pick-type')
  const [typeId, setTypeId]    = useState<string>(initialTemplateId ?? '')
  const [name, setName]        = useState('')
  const [description, setDesc] = useState('')
  const [loading, setLoading]  = useState(false)
  const [error, setError]      = useState<string | null>(null)
  const { user }               = useAuthStore()
  const bots                   = useBotStore((s) => s.bots)

  /** Pre-fill fields from a template. */
  const applyType = (id: string): void => {
    if (id === CUSTOM_TYPE_ID || id === '') {
      setName(''); setDesc('')
      return
    }
    const t = allTemplates.find((x) => x.id === id)
    if (!t) return
    const count = bots.filter((b) => b.templateId === id).length
    setName(count === 0 ? t.name : `${t.name} #${String(count + 1)}`)
    setDesc(t.description)
  }

  // Pre-fill when opened with an initial template (run once on mount).
  useEffect(() => {
    if (initialTemplateId !== undefined) applyType(initialTemplateId)
  }, []) // run once on mount — applyType is stable

  const handlePickType = (id: string): void => {
    setTypeId(id)
    applyType(id)
    setStep('configure')
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await useBotStore.getState().createBot({
        name: name.trim(),
        description: description.trim(),
        ...(typeId !== '' && typeId !== CUSTOM_TYPE_ID ? { templateId: typeId } : {}),
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const selectedTemplate = allTemplates.find((t) => t.id === typeId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">

        {/* Modal header */}
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-4">
          {step === 'configure' && !startAtConfigure && (
            <button
              type="button"
              onClick={() => { setStep('pick-type') }}
              className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {step === 'pick-type' ? 'Choose a bot type' : 'Configure your bot'}
            </h2>
            {step === 'configure' && (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {selectedTemplate
                  ? `${selectedTemplate.icon} ${selectedTemplate.name} type`
                  : 'Custom bot — no template'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          >
            ✕
          </button>
        </div>

        {/* Step 1 — Pick type */}
        {step === 'pick-type' && (
          <div className="p-6">
            {!user && (
              <div className="mb-4 rounded-xl bg-blue-500/10 px-4 py-3 text-xs text-blue-300">
                No sign-in needed — bots are saved locally on this device.
              </div>
            )}
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
              Select a type. You can create as many bots of the same type as you need.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {allTemplates.map((t) => {
                const count      = bots.filter((b) => b.templateId === t.id).length
                const colorClass = TEMPLATE_CATEGORY_COLORS[t.category]
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { handlePickType(t.id) }}
                    className="flex flex-col items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-left transition-all hover:border-[var(--color-accent)] hover:bg-[var(--color-surface)] hover:shadow-[0_0_0_1px_var(--color-accent-dim)]"
                  >
                    <div className="flex w-full items-start justify-between gap-1">
                      <span className="text-2xl">{t.icon}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
                        {t.category}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t.name}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-secondary)]">
                        {t.description}
                      </p>
                    </div>
                    {count > 0 && (
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {String(count)} bot{count !== 1 ? 's' : ''} created
                      </p>
                    )}
                  </button>
                )
              })}

              {/* Custom option */}
              <button
                type="button"
                onClick={() => { handlePickType(CUSTOM_TYPE_ID) }}
                className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-left transition-all hover:border-[var(--color-accent)] hover:bg-[var(--color-surface)]"
              >
                <span className="text-2xl">✏️</span>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Custom</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-secondary)]">
                    Start from scratch with your own setup.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Configure */}
        {step === 'configure' && (
          <form onSubmit={(e) => { void handleSubmit(e) }} className="flex flex-col gap-4 p-6">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Bot name *</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value) }}
                placeholder="e.g. Morning digest"
                required
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Description</span>
              <input
                value={description}
                onChange={(e) => { setDesc(e.target.value) }}
                placeholder="Optional short description"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
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
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create Bot'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Bot instance row ─────────────────────────────────────────────────────────

interface IBotInstanceRowProps {
  bot: IDesktopBot
  runningBotIds: string[]
  templateIcon?: string
  templateName?: string
  onOpen: (id: string) => void
}

function BotInstanceRow({ bot, runningBotIds, templateIcon, templateName, onOpen }: IBotInstanceRowProps): React.JSX.Element {
  const isRunning = runningBotIds.includes(bot.id)

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 transition-colors hover:border-[var(--color-accent)]/40">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          isRunning
            ? 'animate-pulse bg-blue-400'
            : bot.status === 'active'
              ? 'bg-[var(--color-success)]'
              : 'bg-yellow-400'
        }`}
      />
      {templateIcon && <span className="shrink-0 text-base">{templateIcon}</span>}
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-primary)]">
        {bot.name}
      </span>
      {templateName && (
        <span className="hidden shrink-0 rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] sm:inline">
          {templateName}
        </span>
      )}
      {bot.synced && (
        <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]" title="Cloud synced">☁</span>
      )}
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          bot.status === 'active'
            ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
            : 'bg-yellow-400/15 text-yellow-400'
        }`}
      >
        {bot.status}
      </span>
      <button
        onClick={() => { onOpen(bot.id) }}
        className="shrink-0 rounded-lg bg-[var(--color-accent-dim)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
      >
        ▶ Open
      </button>
    </div>
  )
}

// ─── Unified bot-type card (same visual for agent types AND built-in bots) ─────────────

interface IBotTypeCardProps {
  icon: string
  label: string
  description: string
  badge: string
  badgeClass: string
  /** undefined = built-in bot (no user instances); 0+ = agent bot type */
  botCount?: number
  runningCount?: number
  /** true when the built-in panel is currently open */
  isActive?: boolean
  onAction: () => void
}

function BotTypeCard({
  icon, label, description, badge, badgeClass,
  botCount, runningCount = 0, isActive = false, onAction,
}: IBotTypeCardProps): React.JSX.Element {
  const isTool = botCount === undefined
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-[var(--color-surface)] p-5 transition-all ${
        isActive
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
              {String(botCount)} bot{botCount !== 1 ? 's' : ''}
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
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          isActive
            ? 'bg-emerald-950/50 text-emerald-400 hover:bg-emerald-900/50'
            : 'bg-[var(--color-accent-dim)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white'
        }`}
      >
        {isTool
          ? (isActive ? '● Open' : '→ Open')
          : '+ Add Bot'}
      </button>
    </div>
  )
}

// ─── FeatureGrid (Bots tab) ───────────────────────────────────────────────────

/**
 * FeatureGrid — the Bots tab.
 * Bot types (templates) are the primary organisational unit.
 * Each type card is expandable and shows all its bot instances.
 * One bot type can power any number of bots with different names and configurations.
 */
export function FeatureGrid({ onOpenModule }: IFeatureGridProps): React.JSX.Element {
  const bots              = useBotStore((s) => s.bots)
  const runningBotIds     = useBotStore((s) => s.runningBotIds)
  const installedTypeIds  = useBotTypeStore((s) => s.installedTypeIds)

  // All bot types = built-in + installed downloadable types
  const allTemplates = useMemo(() => [
    ...BOT_TEMPLATES,
    ...BOT_TYPE_CATALOG.filter((t) => installedTypeIds.includes(t.id)),
  ], [installedTypeIds])

  const [search, setSearch]            = useState('')
  const [showCreate, setShowCreate]    = useState(false)
  const [createTemplate, setCreateTpl] = useState<string | undefined>(undefined)

  useEffect(() => { void useBotStore.getState().loadBots() }, [])

  const openCreate = (templateId?: string): void => {
    setCreateTpl(templateId)
    setShowCreate(true)
  }

  // Group bots by templateId — used for bot count on type cards.
  const botsByTemplate = useMemo<Record<string, IDesktopBot[]>>(() => {
    const map: Record<string, IDesktopBot[]> = {}
    for (const t of allTemplates) map[t.id] = []
    for (const bot of bots) {
      if (bot.templateId !== undefined && bot.templateId in map) {
        const bucket = map[bot.templateId]
        if (bucket !== undefined) bucket.push(bot)
      }
    }
    return map
  }, [bots, allTemplates])

  // All bots sorted newest-first for the flat "My Bots" list.
  const allBots = useMemo(
    () => [...bots].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [bots],
  )

  // Search filtering.
  const q = search.toLowerCase()

  const visibleTemplates = search.length === 0
    ? allTemplates
    : allTemplates.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
      )

  const visibleAllBots = search.length === 0
    ? allBots
    : allBots.filter((b) => {
        const tmpl = b.templateId ? allTemplates.find((t) => t.id === b.templateId) : undefined
        return (
          b.name.toLowerCase().includes(q) ||
          (tmpl?.name.toLowerCase().includes(q) ?? false)
        )
      })

  const isEmpty = visibleTemplates.length === 0 && visibleAllBots.length === 0

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">

      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Bots</h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Create multiple bots from the same type, each with its own name.
            </p>
          </div>
          <button
            onClick={() => { openCreate() }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            + New Bot
          </button>
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
              placeholder="Search bot types or bots…"
              value={search}
              onChange={(e) => { setSearch(e.target.value) }}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* All Bot Types */}
          {visibleTemplates.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  All Bot Types
                </p>
                <button
                  type="button"
                  onClick={() => { onOpenModule('store') }}
                  className="text-[10px] text-[var(--color-accent)] hover:underline"
                >
                  Browse more →
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {visibleTemplates.map((template) => {
                  const typeBots     = botsByTemplate[template.id] ?? []
                  const runningCount = typeBots.filter((b) => runningBotIds.includes(b.id)).length
                  return (
                    <BotTypeCard
                      key={template.id}
                      icon={template.icon}
                      label={template.name}
                      description={template.description}
                      badge={template.category}
                      badgeClass={TEMPLATE_CATEGORY_COLORS[template.category]}
                      botCount={typeBots.length}
                      runningCount={runningCount}
                      onAction={() => { openCreate(template.id) }}
                    />
                  )
                })}

              </div>
            </section>
          )}

          {/* My Bots — flat list of all bot instances (newest first) */}
          {visibleAllBots.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                My Bots
              </p>
              <div className="space-y-2">
                {visibleAllBots.map((bot) => {
                  const tmpl = bot.templateId ? allTemplates.find((t) => t.id === bot.templateId) : undefined
                  return (
                    <BotInstanceRow
                      key={bot.id}
                      bot={bot}
                      runningBotIds={runningBotIds}
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

      {/* Create Bot wizard */}
      {showCreate && (
        <CreateBotModal
          allTemplates={allTemplates}
          {...(createTemplate !== undefined ? { initialTemplateId: createTemplate } : {})}
          onClose={() => { setShowCreate(false); setCreateTpl(undefined) }}
        />
      )}
    </div>
  )
}
